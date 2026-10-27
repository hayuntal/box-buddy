import { isSupabaseConfigured } from "@/lib/supabase/server";
import { memoryRepo } from "./memory";
import type { Repo } from "./repo";
import { supabaseRepo } from "./supabase";

export type * from "./repo";

/**
 * Picks the storage adapter. Supabase whenever it is configured, the seeded
 * in-process store otherwise, so a fresh clone runs with no setup at all.
 */
export function getRepo(): Repo {
  return isSupabaseConfigured() ? supabaseRepo() : memoryRepo();
}
