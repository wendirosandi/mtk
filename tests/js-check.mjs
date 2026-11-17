// tests/js-check.mjs — cek sintaks semua JavaScript lokal tanpa dependency.
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const roots = ["lib", "src", "pages", "scripts", "tests", "LKPD/core", "LKPD/data", "kalender-pythagoras/assets/js"];
const skip = /node_modules|\.git|golden|ringkasan-proyek/;
const files = [];

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (skip.test(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (/\.(js|mjs)$/.test(name)) files.push(full);
  }
}

roots.forEach(walk);
let failed = 0;
for (const file of files) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) {
    failed++;
    console.error("FAIL", relative(process.cwd(), file));
    if (r.stderr) console.error(r.stderr.trim());
  }
}
console.log(`JS syntax: ${files.length - failed}/${files.length} OK`);
process.exit(failed ? 1 : 0);
