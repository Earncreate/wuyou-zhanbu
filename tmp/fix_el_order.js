// 按 EL_GROUP 次序重排要素 + 组内去重，并回写 diet64.js
const fs = require('fs');
const path = require('path');
const ORDER = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10'];
const d = require('./diet64.js');
const fixed = d.map((t) => {
  const dedup = [];
  t.el.forEach((e) => { if (dedup.indexOf(e) < 0) dedup.push(e); });
  const srt = dedup.slice().sort((a, b) => ORDER.indexOf(a.split(':')[0]) - ORDER.indexOf(b.split(':')[0]));
  return Object.assign({}, t, { el: srt });
});
const head = '// 饮食模块 64 类事物（要素依典籍类象次序：物形→部位→质地→五味→五色→气味→时→方→功用→类象）\n'
  + '// 由 fix_el_order.js 按 EL_GROUP 次序重排并去重生成\nmodule.exports = [\n';
const lines = fixed.map((t) => '  { w:' + JSON.stringify(t.w) + ', l1:' + t.l1 + ', l2:' + t.l2 + ', x:' + t.x
  + ', el:[' + t.el.map((e) => JSON.stringify(e)).join(',') + ']'
  + ', note:' + JSON.stringify(t.note)
  + ', m:{mat:' + t.m.mat + ',form:' + t.m.form + ',state:' + t.m.state + ',mot:' + t.m.mot + '} },').join('\n');
fs.writeFileSync(path.join(__dirname, 'diet64.js'), head + lines + '\n];\n');
console.log('重写完成 ' + fixed.length + ' 条');
const d2 = require('./diet64.js');
let bad = [];
d2.forEach((t) => { const gs = t.el.map((e) => e.split(':')[0]); for (let i = 1; i < gs.length; i++) { if (ORDER.indexOf(gs[i]) < ORDER.indexOf(gs[i - 1])) { bad.push(t.w + ':' + gs.join('>')); break; } } });
console.log('未按典籍次序:', bad.length, bad.slice(0, 4).join('；'));
const el = d2.map((t) => t.el.length);
console.log('要素 min ' + Math.min.apply(null, el) + ' max ' + Math.max.apply(null, el)
  + ' 平均 ' + (el.reduce((a, b) => a + b, 0) / el.length).toFixed(2) + ' 总数 ' + el.reduce((a, b) => a + b, 0));
console.log('重复要素:', d2.filter((t) => new Set(t.el).size !== t.el.length).map((t) => t.w).join(',') || '无');
['猪肉', '牛肉', '青菜', '辣椒'].forEach((w) => { const t = d2.find((x) => x.w === w); console.log(w + ':', t.el.join('>')); });
