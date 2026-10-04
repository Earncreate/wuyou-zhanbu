// 检查 chartText 是否已注入【日月架构】与【日月力量】
var path = require('path');
var LY = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'liuyao.js'));
var CFG = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'config.js'));

var chart = LY.arrange({
  yearGanZhi: '丙午', monthGanZhi: '丁酉', dayGanZhi: '戊申', hourGanZhi: '己未',
  solarText: '2026-10-01 13:41', lunarText: '八月十一', jieqi: '秋分',
  six: [{ sum: 7 }, { sum: 9 }, { sum: 9 }, { sum: 6 }, { sum: 7 }, { sum: 8 }]
});

var t = CFG.chartText(chart, CFG.MODULES.diet);
var okArch = /【日月架构·力量根基/.test(t);
var okPower = /【日月力量·逐爻/.test(t);
var okCmp = /比较结论/.test(t);
console.log('注入 日月架构: ' + okArch);
console.log('注入 日月力量: ' + okPower);
console.log('注入 比较结论: ' + okCmp);
console.log('\n——— chartText 中日月相关片段 ———');
t.split('\n').forEach(function (l) {
  if (/日月架构|日月关系|日月力量|合计|比较/.test(l)) console.log(l);
});
process.exit((okArch && okPower && okCmp) ? 0 : 1);
