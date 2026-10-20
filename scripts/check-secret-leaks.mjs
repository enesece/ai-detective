// Fails if any secret text from a case fixture shows up in what the browser can download:
// client JS bundles (.next/static) and prerendered HTML / RSC payloads (.next/server/app).
// Run after `next build`:  npm run check:leaks
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FIXTURES_DIR = "src/server/cases/fixtures";
const SHIPPED_DIRS = [".next/static", ".next/server/app"];
const SHIPPED_FILE = /\.(js|html|rsc|body|segment\.rsc)$/;
const MIN_LENGTH = 12; // skip short values like ids and "HH:MM" that also exist publicly

function collectStrings(value, out) {
  if (typeof value === "string") out.add(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === "object")
    Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const secrets = [];
for (const file of readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"))) {
  const data = JSON.parse(readFileSync(join(FIXTURES_DIR, file), "utf8"));
  const publicStrings = collectStrings(data.public, new Set());
  for (const s of collectStrings(data.secret, new Set())) {
    if (s.length >= MIN_LENGTH && !publicStrings.has(s)) secrets.push({ file, text: s });
  }
}

const shipped = SHIPPED_DIRS.flatMap((dir) => walk(dir)).filter((p) => SHIPPED_FILE.test(p));
// JSON-escape so quotes inside secrets match how they appear in bundles and payloads.
const contents = shipped.map((path) => ({ path, text: readFileSync(path, "utf8") }));

const leaks = [];
for (const secret of secrets) {
  const needles = [secret.text, JSON.stringify(secret.text).slice(1, -1)];
  for (const { path, text } of contents) {
    if (needles.some((n) => text.includes(n))) leaks.push({ ...secret, path });
  }
}

if (leaks.length > 0) {
  console.error(`✗ ${leaks.length} secret leak(s) found:`);
  for (const l of leaks) console.error(`  ${l.path}: "${l.text.slice(0, 60)}…" (${l.file})`);
  process.exit(1);
}
console.log(
  `✓ No leaks: checked ${secrets.length} secret strings against ${shipped.length} shipped files.`,
);
