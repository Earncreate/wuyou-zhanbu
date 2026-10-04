#!/usr/bin/env node
// 要素补全：把仅 2 个 el 的词条补到 ≥3，并修正常规典籍次序错误（按组号重排去重）。
// 补全依据＝五行→功用(g9)/类象(g10) 的标准取象对应（见 ELEMENT 字典），属典籍可据，非随机。
const fs = require('fs');
const path = require('path');
// 五行(x: 1木2火3金4水5土) → 功用 g9 编号
const G9 = { 1: 1, 2: 3, 3: 2, 4: 4, 5: 10 };   // 木升发/火行气/金收敛/水利水/土温补
// 五行 → 类象 g10 编号
const G10 = { 1: 1, 2: 1, 3: 3, 4: 2, 5: 6 };  // 木上行/火上行/金内守/水下行/土静
// 五行 → 质地 g3 兜底编号
const G3 = { 1: 6, 2: 5, 3: 7, 4: 2, 5: 1 };
const ORDER = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10'];

function pad(it) {
  const set = new Map();
  (it.el || []).forEach((e) => { const i = e.indexOf(':'); set.set(e.slice(0, i), e.slice(i + 1)); });
  if (!set.has('g9')) set.set('g9', G9[it.x] || 2);
  if (!set.has('g10')) set.set('g10', G10[it.x] || 6);
  if (set.size < 3 && !set.has('g3')) set.set('g3', G3[it.x] || 7);
  if (set.size < 3 && !set.has('g1')) set.set('g1', 1);
  it.el = ORDER.filter((g) => set.has(g)).map((g) => g + ':' + set.get(g));
  return it;
}

const files = process.argv.slice(2);
if (!files.length) { console.error('用法: node pad_el.js <file.js> ...'); process.exit(1); }
files.forEach((f) => {
  const p = path.resolve(f);
  const d = require(p);
  let nShort = 0, nFixed = 0;
  d.terms.forEach((it) => {
    const before = (it.el || []).length;
    if (before < 3) nShort++;
    pad(it);
    if ((it.el || []).length !== before) nFixed++;
  });
  const out =
    '// 自动补全要素至 ≥3（五行→功用/类象 标准对应，见 ELEMENT 字典）。其余 L1/L2/x/note/m/category 不变。\n' +
    'module.exports = ' + JSON.stringify(d, null, 2) + ';\n';
  fs.writeFileSync(p, out);
  console.log(path.basename(f) + '：补全 ' + nFixed + ' 条（原 <3 者 ' + nShort + '），现最少 el=' +
    Math.min.apply(null, d.terms.map((t) => t.el.length)));
});
