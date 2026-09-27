// Verifies the partner logo files referenced by src/data/partners.ts.
//
// Usage: node scripts/check-partner-logos.mjs
//
// Checks, for every `logo` path in the data file:
//   - the file exists in public/partners/
//   - the bytes are a real image (magic bytes), not HTML / 404 text / truncated data
//   - the extension matches the real format (warn only)
//   - the path matches a filename the downloader knows how to produce

import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { LOGOS, OUT_DIR, detectImageFormat } from "./fetch-partner-logos.mjs";

const DATA_FILE = path.resolve("src/data/partners.ts");

const EXTENSION_FORMAT = {
  ".png": "png",
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".webp": "webp",
  ".gif": "gif",
  ".svg": "svg",
};

const KNOWN_FILES = new Set(LOGOS.map((logo) => `/partners/${logo.file}`));

function readLogoPaths(source) {
  const paths = [];
  for (const match of source.matchAll(/logo:\s*"(\/partners\/[^"]+)"/g)) {
    paths.push(match[1]);
  }
  return paths;
}

const problems = [];
const warnings = [];
const ok = [];

const source = await readFile(DATA_FILE, "utf8");
const logoPaths = readLogoPaths(source);

if (logoPaths.length === 0) {
  console.log("No logo paths declared in src/data/partners.ts (all placeholders).");
} else {
  console.log(`Found ${logoPaths.length} logo path(s) in src/data/partners.ts\n`);
}

for (const logoPath of logoPaths) {
  const fileName = path.basename(logoPath);

  if (!KNOWN_FILES.has(logoPath)) {
    problems.push(
      `${logoPath}: not produced by scripts/fetch-partner-logos.mjs (unknown filename/extension)`,
    );
    continue;
  }

  const filePath = path.join(OUT_DIR, fileName);
  if (!existsSync(filePath)) {
    problems.push(`${logoPath}: MISSING file (run: npm run logos)`);
    continue;
  }

  const { size } = await stat(filePath);
  const buf = await readFile(filePath);
  const format = detectImageFormat(buf);

  if (!format) {
    problems.push(
      `${logoPath}: INVALID image data (${size} bytes, no image signature) - delete the file to restore the placeholder`,
    );
    continue;
  }
  if (format === "pdf") {
    problems.push(`${logoPath}: INVALID - file is a PDF, not an image`);
    continue;
  }

  const expected = EXTENSION_FORMAT[path.extname(fileName).toLowerCase()];
  if (expected && expected !== format) {
    warnings.push(
      `${logoPath}: content is ${format} but the extension is ${path.extname(fileName)} (browsers still render it)`,
    );
  }

  ok.push(`${logoPath} (${format}, ${(size / 1024).toFixed(1)} kB)`);
  console.log(`OK       ${logoPath} -> ${format}, ${size} bytes`);
}

const missingFromScript = LOGOS.filter(
  (logo) => !logoPaths.includes(`/partners/${logo.file}`),
);
if (missingFromScript.length > 0 && logoPaths.length > 0) {
  warnings.push(
    `downloader knows ${missingFromScript.length} logo(s) not referenced in partners.ts: ${missingFromScript
      .map((logo) => logo.file)
      .join(", ")}`,
  );
}

console.log(`\n${ok.length}/${logoPaths.length} referenced logos are valid.`);

if (warnings.length > 0) {
  console.log("\nWarnings:");
  for (const item of warnings) console.log(`  - ${item}`);
}

if (problems.length > 0) {
  console.log("\nProblems:");
  for (const item of problems) console.log(`  - ${item}`);
  process.exitCode = 1;
}
