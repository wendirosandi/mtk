// harness.mjs — uji determinisme generator LKPD via golden files.
// Pakai: node tests/generators/harness.mjs [--update]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const files = ['LKPD/lib/config.js','LKPD/data/DATA_POOL.js','LKPD/core/GENERATORS.js','LKPD/core/SCORING_LOGIC.js'];
const ctx = { window: {}, document: { createElement: () => ({ style: {} }), addEventListener(){} }, localStorage: { getItem:()=>null, setItem(){} }, console };
ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of files) vm.runInContext(readFileSync(join(root,f),'utf8'), ctx, { filename: f });
// seed deterministik
ctx.window.__SALT = 20260101;
vm.runInContext('Math.random = (function(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})(window.__SALT);', ctx);
const cases = [
  { code:'GEN', fn:'genPangkatMC', cat:'B' },
  { code:'GEN', fn:'genAkarMC',    cat:'A' },
  { code:'GEN', fn:'genBakuMC',    cat:'C' }
];
let fail = 0;
for (const c of cases) {
  const out = vm.runInContext(`(function(){ currentDiff='${c.cat}'; var g=window.GENERATORS.get('${c.fn}'); var r=g('${c.cat}'); return JSON.stringify(r); })()`, ctx);
  const gp = join(root,'tests/generators/golden', `${c.code}_${c.fn}_${c.cat}.json`);
  if (process.argv.includes('--update')) {
    mkdirSync(dirname(gp), { recursive: true });
    writeFileSync(gp, out);
    console.log('WRITE', gp);
    continue;
  }
  if (!existsSync(gp)) {
    fail++;
    console.error('MISSING', gp, '(jalankan dengan --update)');
    continue;
  }
  const exp = readFileSync(gp,'utf8');
  if (exp.trim() !== out.trim()) { fail++; console.error('MISMATCH', gp); }
  else console.log('OK', gp);
}
process.exit(fail ? 1 : 0);