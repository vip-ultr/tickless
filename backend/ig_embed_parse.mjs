// Offline helper for test_backend.py::test_ig_single_image_embed_markup_fallback.
// Feeds a saved Instagram embed page through the same parser the sidecar uses
// and prints the recovered node as JSON.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [file, id] = process.argv.slice(2);

// the vendored cobalt tree is ESM scoped by cobalt/api/package.json, so this
// must be run with cwd=backend/cobalt/api (see the test) — node refuses to
// resolve it without a package root.
const { parseEmbedMarkup } = await import(
    pathToFileURL(join(here, "cobalt/api/src/processing/services/instagram.js")).href
);

const html = readFileSync(file, "utf8");
const node = parseEmbedMarkup(html, id || "TESTID");
process.stdout.write(JSON.stringify(node === undefined ? null : node));
