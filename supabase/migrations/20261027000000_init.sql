-- Box Buddy initial schema.
--
-- Isolation model: every row belongs to a household, and every policy checks
-- membership through `profiles`. A parent can only ever see their own
-- household's children, inventory, scans and plans.

create type tier as enum ('free', 'premium');
create type allergen as enum (
  'peanut', 'tree_nut', 'sesame', 'dairy', 'gluten', 'egg', 'soy', 'fish', 'shellfish'
);
create type allergy_severity as enum ('ban', 'avoid');
create type ingredient_category as enum ('base', 'spread', 'protein', 'side');
create type availability as enum ('plenty', 'low', 'out');
create type inventory_source as enum ('scan', 'manual', 'baseline');
create type dislike_kind as enum ('ingredient', 'rule');
create type plan_mode as enum ('daily', 'weekly', 'rescue');
create type entry_status as enum ('suggested', 'accepted', 'rejected', 'packed');
create type shot_type as enum ('door', 'shelf', 'drawer', 'pantry', 'unknown');
create type week_start as enum ('sunday', 'monday');

-- ---------------------------------------------------------------- households

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier tier not null default 'free',
  week_start week_start not null default 'sunday',
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  household_id uuid not null references households on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create index profiles_household_idx on profiles (household_id);

-- The membership lookup every policy below depends on. SECURITY DEFINER so a
-- policy on `profiles` itself cannot recurse into its own policy check.
create or replace function current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from profiles where id = auth.uid();
$$;

-- ------------------------------------------------------------------ children

create table children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text not null,
  birth_year int,
  grade text,
  color text not null default 'sky',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index children_household_idx on children (household_id);

create table child_allergies (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children on delete cascade,
  allergen allergen not null,
  severity allergy_severity not null default 'ban',
  unique (child_id, allergen)
);

create table child_dislikes (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children on delete cascade,
  kind dislike_kind not null,
  value text not null,
  note text,
  unique (child_id, kind, value)
);

-- One row per child; the rules are a small fixed set, so columns beat a
-- rule table here.
create table child_variety_rules (
  child_id uuid primary key references children on delete cascade,
  no_repeat_within_days int not null default 2,
  max_sweet_per_week int not null default 1,
  require_fresh_veg boolean not null default true
);

-- A school rule with a null child_id applies to the whole household.
create table school_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  child_id uuid references children on delete cascade,
  rule_key text not null,
  unique (household_id, child_id, rule_key)
);

create index school_rules_household_idx on school_rules (household_id);

-- --------------------------------------------------------------- ingredients

-- Shared reference data, seeded from src/lib/catalog.ts. Readable by every
-- authenticated user and writable by nobody through the API.
create table ingredients (
  slug text primary key,
  display_name text not null,
  category ingredient_category not null,
  allergen_tags allergen[] not null default '{}',
  traits text[] not null default '{}',
  is_staple boolean not null default false,
  locale text not null default 'en'
);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  ingredient_slug text not null references ingredients on delete cascade,
  availability availability not null default 'plenty',
  source inventory_source not null default 'manual',
  confidence numeric(3, 2),
  updated_at timestamptz not null default now(),
  -- One row per ingredient per household: a scan upserts into it rather than
  -- appending, so the inventory is always a current state and not a log.
  unique (household_id, ingredient_slug)
);

create index inventory_household_idx on inventory_items (household_id);

-- --------------------------------------------------------------------- scans

create table scans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  created_by uuid references profiles on delete set null,
  provider text not null,
  shot_count int not null default 0,
  -- The expensive part of a scan is the model call, so its result is kept
  -- verbatim: re-reading a scan never costs anything twice.
  raw_result jsonb,
  cost_cents int,
  created_at timestamptz not null default now()
);

create index scans_household_created_idx on scans (household_id, created_at desc);

create table scan_images (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans on delete cascade,
  storage_path text not null,
  shot_type shot_type not null default 'unknown'
);

-- ---------------------------------------------------------------- meal plans

create table meal_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  mode plan_mode not null,
  start_date date not null,
  created_at timestamptz not null default now()
);

create index meal_plans_household_idx on meal_plans (household_id, start_date desc);

create table meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references meal_plans on delete cascade,
  child_id uuid not null references children on delete cascade,
  entry_date date not null,
  status entry_status not null default 'suggested',
  base_slug text references ingredients,
  spread_slugs text[] not null default '{}',
  protein_slugs text[] not null default '{}',
  side_slugs text[] not null default '{}',
  separate_slugs text[] not null default '{}',
  instructions text not null,
  shortfall_reason text,
  reject_reason text,
  created_at timestamptz not null default now(),
  unique (meal_plan_id, child_id, entry_date)
);

-- The variety rules read accepted and packed entries as history, so this is
-- the index that query depends on.
create index meal_plan_entries_history_idx
  on meal_plan_entries (child_id, entry_date desc)
  where status in ('accepted', 'packed');

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references meal_plans on delete cascade,
  ingredient_slug text not null references ingredients on delete cascade,
  reason text not null,
  times_needed int not null default 1,
  is_checked boolean not null default false,
  unique (meal_plan_id, ingredient_slug)
);

-- ------------------------------------------------------------------ policies

alter table households enable row level security;
alter table profiles enable row level security;
alter table children enable row level security;
alter table child_allergies enable row level security;
alter table child_dislikes enable row level security;
alter table child_variety_rules enable row level security;
alter table school_rules enable row level security;
alter table ingredients enable row level security;
alter table inventory_items enable row level security;
alter table scans enable row level security;
alter table scan_images enable row level security;
alter table meal_plans enable row level security;
alter table meal_plan_entries enable row level security;
alter table shopping_items enable row level security;

create policy "read own household" on households
  for select using (id = current_household_id());
create policy "update own household" on households
  for update using (id = current_household_id());
-- A household row is created by the signed-in user during onboarding, before
-- their profile exists; the profile insert below ties them together.
create policy "create a household" on households
  for insert with check (true);

create policy "read own profile row" on profiles
  for select using (id = auth.uid() or household_id = current_household_id());
create policy "create own profile row" on profiles
  for insert with check (id = auth.uid());
create policy "update own profile row" on profiles
  for update using (id = auth.uid());

create policy "household children" on children
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

create policy "household inventory" on inventory_items
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

create policy "household school rules" on school_rules
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

create policy "household scans" on scans
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

create policy "household meal plans" on meal_plans
  for all using (household_id = current_household_id())
  with check (household_id = current_household_id());

-- Child-scoped tables inherit isolation through their child's household.
create policy "household child allergies" on child_allergies
  for all using (
    exists (select 1 from children c where c.id = child_id and c.household_id = current_household_id())
  ) with check (
    exists (select 1 from children c where c.id = child_id and c.household_id = current_household_id())
  );

create policy "household child dislikes" on child_dislikes
  for all using (
    exists (select 1 from children c where c.id = child_id and c.household_id = current_household_id())
  ) with check (
    exists (select 1 from children c where c.id = child_id and c.household_id = current_household_id())
  );

create policy "household child variety rules" on child_variety_rules
  for all using (
    exists (select 1 from children c where c.id = child_id and c.household_id = current_household_id())
  ) with check (
    exists (select 1 from children c where c.id = child_id and c.household_id = current_household_id())
  );

create policy "household scan images" on scan_images
  for all using (
    exists (select 1 from scans s where s.id = scan_id and s.household_id = current_household_id())
  ) with check (
    exists (select 1 from scans s where s.id = scan_id and s.household_id = current_household_id())
  );

create policy "household plan entries" on meal_plan_entries
  for all using (
    exists (select 1 from meal_plans p where p.id = meal_plan_id and p.household_id = current_household_id())
  ) with check (
    exists (select 1 from meal_plans p where p.id = meal_plan_id and p.household_id = current_household_id())
  );

create policy "household shopping items" on shopping_items
  for all using (
    exists (select 1 from meal_plans p where p.id = meal_plan_id and p.household_id = current_household_id())
  ) with check (
    exists (select 1 from meal_plans p where p.id = meal_plan_id and p.household_id = current_household_id())
  );

-- Reference data: readable by anyone signed in, never writable from the API.
create policy "ingredients are readable" on ingredients
  for select using (auth.role() = 'authenticated');

-- ------------------------------------------------------------- scan storage

insert into storage.buckets (id, name, public)
values ('scans', 'scans', false)
on conflict (id) do nothing;

-- Photos live under <household_id>/<scan_id>/<shot>.jpg, so the first path
-- segment is what scopes access.
create policy "household reads own scan photos" on storage.objects
  for select using (
    bucket_id = 'scans' and (storage.foldername(name))[1] = current_household_id()::text
  );

create policy "household uploads own scan photos" on storage.objects
  for insert with check (
    bucket_id = 'scans' and (storage.foldername(name))[1] = current_household_id()::text
  );

create policy "household deletes own scan photos" on storage.objects
  for delete using (
    bucket_id = 'scans' and (storage.foldername(name))[1] = current_household_id()::text
  );
