const SYM = require('../libs/symbol_dict.js');
const fs = require('fs');
const order = ['diet','illness','career','wealth','loveM','study','child','home','news','lawsuit','lost','travel','sport','fun'];
let out = '';
order.forEach(m => {
  const t = SYM.MOD_XIANG[m];
  if (!t) { out += `\n## ${m} 无专属表（用 GENERIC）\n`; return; }
  out += `\n## ${m} terms=${t.terms.length}\n`;
  out += `L1(${Object.keys(t.L1).length}): ` + JSON.stringify(t.L1) + '\n';
  out += `L2(${Object.keys(t.L2).length}): ` + JSON.stringify(t.L2) + '\n';
  out += `terms.w:\n` + t.terms.map(x => `  ${x.w}(l1=${x.l1},l2=${x.l2},x=${x.x}${x.el?'':',NO-EL'},el=[${(x.el||[]).join(' ')}])`).join('\n') + '\n';
});
out += `\n=== GENERIC terms=${SYM.GENERIC_XIANG.terms.length} ===\n`;
out += `=== CATEGORY mods: ${Object.keys(SYM.CATEGORY).join(', ')} ===\n`;
out += `=== CATEGORY counts: ` + Object.keys(SYM.CATEGORY).map(k => k+'='+SYM.CATEGORY[k].length).join(', ') + '\n';
fs.writeFileSync(__dirname + '/probe_out.txt', out);
const counts = order.map(m => `${m}=${SYM.MOD_XIANG[m] ? SYM.MOD_XIANG[m].terms.length : 'GEN'}`).join('  ');
console.log(counts);
console.log('done -> probe_out.txt');
