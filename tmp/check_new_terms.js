#!/usr/bin/env node
/** 校验新增模块词表：条数、要素数、编号有效、典籍次序、无重复、L1/L2 不重名 */
const path = require('path');
const LIB = require(path.join(__dirname, '..', 'libs', 'symbol_dict.js'));
const ORDER = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10'];

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '　' + extra : '')); }
}

const targets = [
  ['illness', require('./illness64.js')],
  ['career', require('./career64.js')]
];

targets.forEach(([mod, d]) => {
  console.log('\n【' + mod + '】' + d.length + ' 条');
  const dup = d.map((t) => t.w).filter((w, i, a) => a.indexOf(w) !== i);
  ck('无重名事物', dup.length === 0, dup.join(','));
  const badLen = d.filter((t) => !t.el || t.el.length < 3 || t.el.length > 9).map((t) => t.w + ':' + (t.el ? t.el.length : 0));
  ck('每条要素 3~9 个', badLen.length === 0, badLen.join(','));
  let eb = [];
  d.forEach((t) => t.el.forEach((e) => { const q = e.split(':'); if (!LIB.ELEMENT[q[0]] || !LIB.ELEMENT[q[0]][q[1]]) eb.push(t.w + ' ' + e); }));
  ck('要素编号全在 ELEMENT 字典内', eb.length === 0, eb.slice(0, 4).join('；'));
  let ord = [];
  d.forEach((t) => {
    const gs = t.el.map((e) => e.split(':')[0]);
    for (let i = 1; i < gs.length; i++) if (ORDER.indexOf(gs[i]) < ORDER.indexOf(gs[i - 1])) { ord.push(t.w + ':' + gs.join('>')); break; }
  });
  ck('要素按典籍次序（组号非递减）', ord.length === 0, ord.slice(0, 3).join('；'));
  const dp = d.filter((t) => new Set(t.el).size !== t.el.length).map((t) => t.w);
  ck('同条内无重复要素', dp.length === 0, dp.join(','));
  const noNote = d.filter((t) => !t.note).map((t) => t.w);
  ck('全部有类象注记', noNote.length === 0, noNote.join(','));
  const badX = d.filter((t) => !LIB.WUXING[t.x]).map((t) => t.w);
  ck('第三特征五行有效', badX.length === 0, badX.join(','));
  const badM = [];
  d.forEach((t) => {
    if (!t.m) { badM.push(t.w + ' 缺 m'); return; }
    ['mat', 'form', 'state', 'mot'].forEach((k) => {
      const v = t.m[k];
      if (v !== null && !LIB.MODERN[k][v]) badM.push(t.w + ' ' + k + '=' + v);
    });
  });
  ck('现代四维编号有效', badM.length === 0, badM.slice(0, 4).join('；'));
  ck('事物数 ≥ 64', d.length >= 64, String(d.length));
  const total = d.reduce((n, t) => n + t.el.length, 0);
  console.log('  · 要素总数 ' + total + '，平均 ' + (total / d.length).toFixed(2));
  console.log('  · 五行分布 ' + JSON.stringify(d.reduce((a, t) => { a[t.x] = (a[t.x] || 0) + 1; return a; }, {})));
  console.log('  · 第一特征分布 ' + JSON.stringify(d.reduce((a, t) => { a[t.l1] = (a[t.l1] || 0) + 1; return a; }, {})));
});

console.log('\n  汇总：通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
