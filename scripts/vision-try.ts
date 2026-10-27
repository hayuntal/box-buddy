/**
 * Runs the live vision provider against real photographs and scores it.
 *
 * This exists because the whole product rests on one untested assumption:
 * that a photo of a real fridge turns into a usable inventory. Fixtures
 * cannot answer that — they were written by the same hand as the prompt.
 *
 *   npm run vision:try -- photos/door.jpg photos/shelf.jpg
 *   npm run vision:try -- --truth photos/truth.txt photos/*.jpg
 *
 * Shot types are assigned by position (door, shelf, drawer, pantry), matching
 * the scan screen. `--truth` takes a file of catalog slugs, one per line, of
 * what is really in those photos; with it the script reports recall and
 * precision instead of leaving you to eyeball the list.
 */

import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { CATALOG, getIngredient } from "../src/lib/catalog.ts";
import { normalizeScan } from "../src/lib/vision/normalize.ts";
import { anthropicProvider } from "../src/lib/vision/anthropic.ts";
import type { ShotType } from "../src/lib/vision/types.ts";

const SHOT_ORDER: ShotType[] = ["door", "shelf", "drawer", "pantry"];

const MEDIA_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function parseArgs(argv: string[]): { truth?: string; slugs: boolean; files: string[] } {
  const files: string[] = [];
  let truth: string | undefined;
  let slugs = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--truth") {
      truth = argv[++i];
    } else if (argv[i] === "--slugs") {
      slugs = true;
    } else if (argv[i]?.startsWith("--")) {
      throw new Error(`דגל לא מוכר: ${argv[i]}`);
    } else {
      files.push(argv[i]!);
    }
  }
  return truth === undefined ? { slugs, files } : { truth, slugs, files };
}

function readTruth(path: string): string[] {
  const slugs = readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.split("#")[0]!.trim())
    .filter((line) => line.length > 0);

  const unknown = slugs.filter((s) => !getIngredient(s));
  if (unknown.length > 0) {
    throw new Error(
      `הקובץ מכיל סלאגים שלא קיימים בקטלוג: ${unknown.join(", ")}\n` +
        `(${CATALOG.length} סלאגים קיימים ב-src/lib/catalog.ts)`,
    );
  }
  return slugs;
}

function pct(n: number, of: number): string {
  return of === 0 ? "—" : `${Math.round((n / of) * 100)}%`;
}

async function main() {
  const { truth: truthPath, slugs, files } = parseArgs(process.argv.slice(2));

  // Writing a truth file means naming things the way the catalog does; this
  // prints the vocabulary rather than making you read catalog.ts.
  if (slugs) {
    for (const category of ["base", "spread", "protein", "side"] as const) {
      console.log(`\n# ${category}`);
      for (const i of CATALOG.filter((x) => x.category === category)) {
        console.log(`${i.slug.padEnd(24)} ${i.displayName}`);
      }
    }
    return;
  }

  if (files.length === 0) {
    console.error(
      "שימוש: npm run vision:try -- [--truth truth.txt] photo1.jpg ...\n" +
        "       npm run vision:try -- --slugs    (כל הסלאגים בקטלוג)",
    );
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY לא מוגדר.");

  // Read the truth file before the call, not after: a typo in it should not
  // cost a model request.
  const truth = truthPath ? new Set(readTruth(truthPath)) : null;

  const images = files.map((file, index) => {
    const mediaType = MEDIA_TYPES[extname(file).toLowerCase()];
    if (!mediaType) throw new Error(`סוג קובץ לא נתמך: ${file}`);
    const bytes = readFileSync(file);
    console.log(
      `  ${SHOT_ORDER[index] ?? "unknown"}: ${basename(file)} (${Math.round(bytes.length / 1024)}KB)`,
    );
    return {
      base64: bytes.toString("base64"),
      mediaType,
      shotType: SHOT_ORDER[index] ?? ("unknown" as const),
    };
  });

  const provider = anthropicProvider(apiKey);
  console.log(`\nשולח ${images.length} תמונות אל ${provider.name}…\n`);

  const started = Date.now();
  const raw = await provider.analyze({ images });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const scan = normalizeScan(raw);

  console.log(`המודל החזיר ${raw.items.length} פריטים ב-${seconds} שניות.\n`);

  const show = (title: string, items: { slug: string; displayName: string }[]) => {
    if (items.length === 0) return;
    console.log(`${title} (${items.length}):`);
    for (const i of items) console.log(`  ${i.slug.padEnd(24)} ${i.displayName}`);
    console.log();
  };

  show("נכנסים ישירות למלאי", [...scan.confirmed]);
  show("ממתינים לאישור ההורה", [...scan.needsReview]);
  if (scan.unmatched.length > 0) {
    console.log(`\nנזרקו — לא אוכל לקופסה או ביטחון נמוך (${scan.unmatched.length}):`);
    for (const i of scan.unmatched) {
      console.log(`  ${i.displayName} (${i.confidence.toFixed(2)})`);
    }
    console.log();
  }

  if (scan.unreadableShots.length > 0) {
    console.log(`תמונות לא קריאות: ${scan.unreadableShots.join("; ")}\n`);
  }

  if (!truth) {
    console.log(
      "אין קובץ --truth, אז זו רשימה לקריאה בעיניים. כדי לקבל מדידה, כתבו מה באמת\n" +
        "נמצא בתמונות (סלאג בכל שורה) והריצו שוב עם --truth.",
    );
    return;
  }

  // Precision and recall are measured against what the parent would end up
  // with: confirmed plus whatever they are asked about. A fuzzy match the
  // parent must confirm is a success for the model and a cost for the parent,
  // so both numbers are reported.
  const found = new Set([...scan.confirmed, ...scan.needsReview].map((i) => i.slug));
  const confirmed = new Set(scan.confirmed.map((i) => i.slug));

  const hits = [...found].filter((s) => truth.has(s));
  const misses = [...truth].filter((s) => !found.has(s));
  const falsePositives = [...found].filter((s) => !truth.has(s));

  console.log("מדידה מול הקובץ:");
  console.log(`  באמת במקרר        ${truth.size}`);
  console.log(`  נמצאו (recall)     ${hits.length}/${truth.size}  ${pct(hits.length, truth.size)}`);
  console.log(
    `  מתוכם ללא אישור    ${[...confirmed].filter((s) => truth.has(s)).length}/${truth.size}`,
  );
  console.log(
    `  שגויים (precision) ${falsePositives.length} מתוך ${found.size} · ${pct(found.size - falsePositives.length, found.size)} נכונים`,
  );
  if (misses.length > 0) console.log(`\n  פספוסים: ${misses.join(", ")}`);
  if (falsePositives.length > 0) console.log(`  המצאות:  ${falsePositives.join(", ")}`);
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
