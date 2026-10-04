// 把 tmp/diet64.js 的 97 条带要素词条嵌入 symbol_dict.js 的 diet 表
const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, '..', 'libs', 'symbol_dict.js');
let s = fs.readFileSync(P, 'utf8');
const data = require('./diet64.js');

const lines = data.map((t) => '        { w:' + JSON.stringify(t.w) + ', l1:' + t.l1 + ', l2:' + t.l2 + ', x:' + t.x
  + ', el:[' + t.el.map((e) => JSON.stringify(e)).join(',') + ']'
  + ', note:' + JSON.stringify(t.note)
  + ', m:{mat:' + t.m.mat + ',form:' + t.m.form + ',state:' + t.m.state + ',mot:' + t.m.mot + '} },').join('\n');

// 定位 diet 的 terms 数组并整体替换
const m = s.match(/(diet:/s*/{/s*/n/s*L1:[/s/S]*?/n/s*L2:[^/n]*/n/s*terms: \[\n)([\s\S]*?)(\n      \],)/);
if (!m) { console.error('未定位到 diet terms 块'); process.exit(1); }
s = s.slice(0, m.index) + m[1] + lines + m[3] + s.slice(m.index + m[0].length);
fs.writeFileSync(P, s);
console.log('已嵌入 ' + data.length + ' 条');
