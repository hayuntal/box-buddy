/**
 * Teaches `node --experimental-strip-types` the two things tsconfig gives the
 * app code and Node does not: the "@/..." alias, and extensionless imports.
 * Without it a script cannot import a module out of src/, because that module
 * imports its own neighbours the way the bundler lets it.
 */
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

const SRC = pathToFileURL(resolvePath(import.meta.dirname, "..", "src") + "/").href;
const HAS_EXTENSION = /\.[cm]?[jt]sx?$|\.json$/;

export function resolve(specifier, context, nextResolve) {
  const aliased = specifier.startsWith("@/")
    ? new URL(specifier.slice(2), SRC).href
    : specifier;

  const relative = aliased.startsWith(".") || aliased.startsWith("file:");
  if (relative && !HAS_EXTENSION.test(aliased)) {
    // Every extensionless import in this codebase is a .ts module; a directory
    // index would resolve on its own.
    try {
      return nextResolve(`${aliased}.ts`, context);
    } catch {
      return nextResolve(aliased, context);
    }
  }
  return nextResolve(aliased, context);
}
