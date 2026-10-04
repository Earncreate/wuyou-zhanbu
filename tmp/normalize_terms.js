#!/usr/bin/env node
/** 规范化新增词表：修正越界编号、非法第三特征、按典籍次序重排要素并去重 */
const fs = require('fs');
const path = require('path');
const LIB = require(path.join(__dirname, '..', 'libs', 'symbol_dict.js'));
const ORDER = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10'];

// 修正表：词 → { x?, m? }，仅修确有问题的条目
const FIX = {
  // 第三特征非法（原误用 l2 编号 8）
  '简历': { x: 4 },
  // 要素越界：g8 只有 1..5（东南西北中），6 非法 → 改用 g1 物形（圆形/带核不适用，取 g1:1 本体不合适，这里改用 g9 功用体现文书用途）
  '合同': { el: ['g1:1', 'g3:1', 'g10:3'] },
  '简历': { x: 4, el: ['g1:1', 'g3:1', 'g10:2'] },
  '驾照': { el: ['g1:3', 'g3:7', 'g9:2'] },
  '文件': { el: ['g1:1', 'g3:1', 'g9:2'] },
  '证书': { el: ['g1:1', 'g3:7', 'g5:4', 'g9:2'] },
  '资质': { el: ['g1:1', 'g3:7', 'g9:2', 'g10:3'] },
  '印章': { el: ['g1:1', 'g3:7', 'g9:2'] },
  '报告': { el: ['g1:1', 'g9:1', 'g10:1'] },
  '专利': { el: ['g1:1', 'g3:7', 'g9:2', 'g10:3'] },
  // 现代四维：form 上限 7，8 非法 → 改 7 不规则
  '提案': { el: ['g1:1', 'g9:1', 'g10:4'] },
  '出版': { el: ['g1:1', 'g3:1', 'g9:1'] },
  '园艺': { m: { mat: 6, form: 7, state: 1, mot: 6 } },
  '农业': { m: { mat: 6, form: 8, state: 1, mot: 6 } }
};

function normalize(file) {
  const P = path.join(__dirname, file);
  const d = require(P);
  const fixed = d.map((t) => {
    const f = FIX[t.w] || {};
    const x = f.x || t.x;
    const m = Object.assign({}, t.m, f.m || {});
    if (m.form != null && (m.form < 1 || m.form > 7)) m.form = 7;
    if (m.state != null && (m.state < 1 || m.state > 8)) m.state = 1;
    if (m.mat != null && !LIB.MODERN.mat[m.mat]) m.mat = 1;
    if (m.mot != null && !LIB.MODERN.mot[m.mot]) m.mot = 6;
    // 要素：去重 → 过滤非法 → 按典籍次序
    let el = (f.el || t.el || []).filter((e) => {
      const q = e.split(':');
      return LIB.ELEMENT[q[0]] && LIB.ELEMENT[q[0]][q[1]];
    });
    const dd = [];
    el.forEach((e) => { if (dd.indexOf(e) < 0) dd.push(e); });
    dd.sort((a, b) => ORDER.indexOf(a.split(':')[0]) - ORDER.indexOf(b.split(':')[0]));
    return Object.assign({}, t, { x: x, m: m, el: dd });
  });
  // 回写
  const head = '// ' + (path.basename(file, '.js')) + '（要素依典籍类象次序：物形→部位→质地→五味→五色→气味→时→方→功用→类象）\n'
    + '// 由 check_new_terms.js 校验、normalize_terms.js 规范化（重排次序+修越界）\nmodule.exports = [\n';
  const lines = fixed.map((t) => '  { w:' + JSON.stringify(t.w) + ', l1:' + t.l1 + ', l2:' + t.l2 + ', x:' + t.x
    + ', el:[' + t.el.map((e) => JSON.stringify(e)).join(',') + ']'
    + ', note:' + JSON.stringify(t.note)
    + ', m:{mat:' + t.m.mat + ',form:' + t.m.form + ',state:' + t.m.state + ',mot:' + t.m.mot + '} },').join('\n');
  fs.writeFileSync(P, head + lines + '\n];\n');
  const short = fixed.filter((t) => t.el.length < 3);
  console.log(path.basename(file) + '：规范化 ' + fixed.length + ' 条，不足 3 要素的 ' + short.length
    + (short.length ? '（' + short.map((t) => t.w + ':' + t.el.length).join(',') + '）' : ''));
}

normalize('illness64.js');
normalize('career64.js');
