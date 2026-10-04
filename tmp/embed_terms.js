#!/usr/bin/env node
/** 把 tmp/illness64.js 与 tmp/career64.js 嵌入 libs/symbol_dict.js 对应模块的 terms 块 */
const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, '..', 'libs', 'symbol_dict.js');
let s = fs.readFileSync(P, 'utf8');

function embed(modId, dataFile) {
  const data = require(path.join(__dirname, dataFile));
  const lines = data.map((t) => '        { w: ' + JSON.stringify(t.w) + ', l1: ' + t.l1 + ', l2: ' + t.l2
    + ', x: ' + t.x + ', el: [' + t.el.map((e) => JSON.stringify(e)).join(',') + ']'
    + ', note: ' + JSON.stringify(t.note)
    + ', m: { mat: ' + t.m.mat + ', form: ' + t.m.form + ', state: ' + t.m.state + ', mot: ' + t.m.mot + '} },').join('\n');

  const all = s.split('\n');
  let start = -1;
  for (let i = 0; i < all.length; i++) {
    if (all[i].trim() === 'terms: [' && start < 0
      && all.slice(Math.max(0, i - 8), i).join('\n').indexOf(modId + ': {') >= 0) { start = i; break; }
  }
  if (start < 0) { console.error('未定位 ' + modId + ' 的 terms 块'); process.exit(1); }
  let end = -1;
  for (let i = start + 1; i < all.length; i++) { if (all[i].trim() === ']') { end = i; break; } }
  if (end < 0) { console.error('未找到 ' + modId + ' terms 结束标记'); process.exit(1); }
  s = all.slice(0, start + 1).concat(lines, all.slice(end)).join('\n');
  console.log(modId + '：嵌入 ' + data.length + ' 条（行 ' + (start + 2) + '~' + (start + 1 + data.length) + '）');
}

embed('illness', './illness64.js');
embed('career', './career64.js');
fs.writeFileSync(P, s);
