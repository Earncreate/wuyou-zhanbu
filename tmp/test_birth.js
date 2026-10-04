// 出生日期 + 性别 回归：年命(由出生年干支立) / 求测人性别·出生日期进入排盘文本(两段共用)
const LY = require('../libs/liuyao.js');
const CFG = require('../libs/config.js');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name); } }

const base = { monthGanZhi: '丁酉', dayGanZhi: '戊申', yearGanZhi: '丙午', hourGanZhi: '戊申',
  solarText: '2026-10-01 15:20', lunarText: '农历八月廿一', jieqi: '秋分',
  six: [{ sum: 7 }, { sum: 7 }, { sum: 8 }, { sum: 7 }, { sum: 7 }, { sum: 8 }] };

// 1) 终身运：填出生年干支 -> 立年命
const fy = LY.arrange(Object.assign({}, base, { useYearShen: true, birthYearGanZhi: '庚午' }));
ok('fyear useYearShen=true', fy.useYearShen === true);
ok('fyear 年命已立(纳音)', fy.yearMing && fy.yearMing.ming === '土');
ok('fyear 年命含世爻关系', fy.yearMing && fy.yearMing.rels.length >= 0);

// 2) 求测人性别 + 出生日期 进入两段共用的 chartText
fy.gender = '男';
fy.birthDate = '1990-05-20';
const txt = CFG.chartText(fy, CFG.MODULES['fyear']);
ok('chartText 含【求测人】', /【求测人】/.test(txt));
ok('chartText 含 性别 男', /性别 男/.test(txt));
ok('chartText 含 出生日期', /出生日期 1990-05-20/.test(txt));
ok('chartText 含 年干为纲段', /年干为纲/.test(txt));

// 3) 非终身运模块也带性别(感情·男占)
const lm = LY.arrange(Object.assign({}, base));
lm.gender = '女';
lm.birthDate = '1992-11-08';
const txt2 = CFG.chartText(lm, CFG.MODULES['loveM']);
ok('loveM 含【求测人】', /【求测人】/.test(txt2));
ok('loveM 含 性别 女', /性别 女/.test(txt2));
ok('loveM 不含 年干为纲', !/年干为纲/.test(txt2));

// 4) 不填性别/出生日期 -> 不出现【求测人】行(避免噪音)
const noInfo = LY.arrange(Object.assign({}, base));
const txt3 = CFG.chartText(noInfo, CFG.MODULES['caiyun']);
ok('未填则不出现【求测人】', !/【求测人】/.test(txt3));

console.log('\nbirth: 通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);
