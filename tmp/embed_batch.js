#!/usr/bin/env node
// 行级安全嵌入：只替换 MOD_XIANG[modId] 模块块内的 L1/L2/terms 三块，不跨模块。
// 并替换/追加 CATEGORY[modId]。数据文件 tmp/<mod>64.js 含 { L1, L2, terms, category }。
const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, '..', 'libs', 'symbol_dict.js');
let lines = fs.readFileSync(P, 'utf8').split('\n');

function objLit(o) {
  const ks = Object.keys(o);
  return '{ ' + ks.map((k) => k + ": '" + o[k] + "'").join(', ') + ' }';
}
function termLine(t) {
  return '        { w: ' + JSON.stringify(t.w) + ', l1: ' + t.l1 + ', l2: ' + t.l2 +
    ', x: ' + t.x + ', el: [' + t.el.map((e) => JSON.stringify(e)).join(', ') + ']' +
    ', note: ' + JSON.stringify(t.note) +
    ', m: { mat: ' + t.m.mat + ', form: ' + t.m.form + ', state: ' + t.m.state + ', mot: ' + t.m.mot + ' } },';
}
function catBlock(modId, data) {
  if (!data.category || !data.category.length) return null;
  const body = data.category.map((c) =>
    '      { kw: [' + c.kw.map((k) => JSON.stringify(k)).join(', ') + '], name: ' + JSON.stringify(c.name) +
    ', sel: ' + JSON.stringify(c.sel) + ' }').join(',\n');
  return '    ' + modId + ': [\n' + body + '\n    ],';
}

function embedMod(modId, dataFile) {
  const data = require(path.join(__dirname, dataFile));
  const modXStart = lines.findIndex((l) => l.trim() === 'var MOD_XIANG = {');
  if (modXStart < 0) { console.error('未定位 var MOD_XIANG'); process.exit(1); }
  const modXEnd = lines.slice(modXStart).findIndex((l) => l.trim() === '};') + modXStart;
  let modStart = -1;
  for (let i = modXStart; i < modXEnd; i++) { if (lines[i].trim() === modId + ': {') { modStart = i; break; } }
  if (modStart < 0) { console.error('未定位 MOD_XIANG.' + modId); process.exit(1); }
  let modEnd = -1;
  for (let i = modStart + 1; i < lines.length; i++) {
    if (lines[i].startsWith('    ') && (lines[i].trim() === '},' || lines[i].trim() === '}') && !lines[i].startsWith('      ')) { modEnd = i; break; }
  }
  if (modEnd < 0) { console.error('未定位 ' + modId + ' 块结束'); process.exit(1); }
  // 在 [modStart, modEnd] 内定位 L1/L2/terms 行
  let li = -1, l2i = -1, ti = -1, te = -1;
  for (let i = modStart; i <= modEnd; i++) {
    if (li < 0 && lines[i].trim().startsWith('L1:')) li = i;
    if (l2i < 0 && lines[i].trim().startsWith('L2:')) l2i = i;
    if (ti < 0 && lines[i].trim() === 'terms: [') ti = i;
    if (ti >= 0 && te < 0 && i > ti && lines[i].trim() === ']') te = i;
  }
  if (li < 0 || l2i < 0 || ti < 0 || te < 0) { console.error('L1/L2/terms 定位失败 ' + modId); process.exit(1); }
  // 替换 L1/L2 单行
  lines[li] = '      L1: ' + objLit(data.L1) + ',';
  lines[l2i] = '      L2: ' + objLit(data.L2) + ',';
  // 替换 terms 内容（ti+1 .. te-1）
  const termLines = data.terms.map(termLine);
  lines.splice(ti + 1, te - ti - 1, ...termLines);
  console.log(modId + '：嵌入 terms=' + data.terms.length + '（L1=' + Object.keys(data.L1).length + ', L2=' + Object.keys(data.L2).length + '）');

  // CATEGORY 替换或追加
  if (data.category && data.category.length) {
    const catStart = lines.findIndex((l) => l.trim() === 'var CATEGORY = {');
    const cb = catBlock(modId, data);
    let replaced = false;
    for (let i = catStart; i < lines.length; i++) {
      if (lines[i].trim() === modId + ': [') {
        // 找该 CATEGORY 块结束 `    ],`
        let ce = -1;
        for (let j = i + 1; j < lines.length; j++) { if (lines[j] === '    ],') { ce = j; break; } }
        if (ce < 0) { console.error('CATEGORY.' + modId + ' 结束未定位'); process.exit(1); }
        lines.splice(i, ce - i + 1, ...cb.split('\n'));
        replaced = true;
        console.log(modId + '：替换 CATEGORY=' + data.category.length + '类');
        break;
      }
    }
    if (!replaced) {
      // 追加到 CATEGORY 结束 `  };` 前（最后一个模块已有逗号，直接换行接）
      const catEnd = lines.slice(catStart).findIndex((l) => l.trim() === '};') + catStart;
      lines.splice(catEnd, 0, cb);
      console.log(modId + '：追加 CATEGORY=' + data.category.length + '类');
    }
  }
}

const args = process.argv.slice(2);
if (!args.length) { console.error('用法: node embed_batch.js <modId>:<file> ...'); process.exit(1); }
args.forEach((a) => { const [m, f] = a.split(':'); embedMod(m, f); });
fs.writeFileSync(P, lines.join('\n'));
console.log('已写入', P);
