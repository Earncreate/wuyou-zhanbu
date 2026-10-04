// 终身/年运：年干起六神 + 年命层 回归
var LY = require('../libs/liuyao.js');
var CFG = require('../libs/config.js');
var pass = 0, fail = 0, fails = [];
function ok(name, cond) { if (cond) { pass++; } else { fail++; fails.push(name); } }

// 纳音表抽样
ok('纳音 甲子=金', LY.nayinOf('甲子') === '金');
ok('纳音 丙寅=火', LY.nayinOf('丙寅') === '火');
ok('纳音 庚午=土', LY.nayinOf('庚午') === '土');
ok('纳音 壬申=金', LY.nayinOf('壬申') === '金');
ok('纳音 戊戌=木', LY.nayinOf('戊戌') === '木');
ok('纳音 癸亥=水', LY.nayinOf('癸亥') === '水');

// 年干起六神：useYearShen + 出生年 → 六神起点为出生年干(庚)
var ch1 = LY.arrange({
  yearGanZhi: '丙午', monthGanZhi: '丁酉', dayGanZhi: '戊申', hourGanZhi: '戊申',
  solarText: '2026-10-01 15:20', lunarText: '农历八月廿一', jieqi: '秋分',
  six: [{ sum: 7 }, { sum: 8 }, { sum: 8 }, { sum: 7 }, { sum: 7 }, { sum: 8 }],
  useYearShen: true, birthYearGanZhi: '庚午'
});
ok('年神开关生效 useYearShen', ch1.useYearShen === true);
ok('六神起点取出生年干(庚)', ch1.shenGanZhi && ch1.shenGanZhi.charAt(0) === '庚');
ok('年命五行=土(庚午纳音)', ch1.yearMing && ch1.yearMing.ming === '土');
ok('年命对象含 rels 数组', ch1.yearMing && Array.isArray(ch1.yearMing.rels));
// 出生年干与起卦年干不同：shenGan 应取出生年(庚)而非起卦年(丙)
ok('年神不取起卦年干(丙)', ch1.shenGanZhi.charAt(0) !== '丙');

// 未填出生年：useYearShen 时六神取当年太岁(丙)，无年命
var ch2 = LY.arrange({
  yearGanZhi: '丙午', monthGanZhi: '丁酉', dayGanZhi: '戊申', hourGanZhi: '戊申',
  solarText: '2026-10-01 15:20', lunarText: '农历八月廿一', jieqi: '秋分',
  six: [{ sum: 7 }, { sum: 8 }, { sum: 8 }, { sum: 7 }, { sum: 7 }, { sum: 8 }],
  useYearShen: true
});
ok('无出生年时神取当年太岁(丙)', ch2.shenGanZhi.charAt(0) === '丙');
ok('无出生年年命为 null', ch2.yearMing === null);

// 普通模块：不受年神影响，六神仍以日干(戊)起
var ch3 = LY.arrange({
  yearGanZhi: '丙午', monthGanZhi: '丁酉', dayGanZhi: '戊申', hourGanZhi: '戊申',
  solarText: '2026-10-01 15:20', lunarText: '农历八月廿一', jieqi: '秋分',
  six: [{ sum: 7 }, { sum: 8 }, { sum: 8 }, { sum: 7 }, { sum: 7 }, { sum: 8 }]
});
ok('普通模块六神取日干(戊)', ch3.shenGanZhi.charAt(0) === '戊');
ok('普通模块无年命层', ch3.yearMing === null);

// 年命与世爻关系：构造一个年命克世/生世的必然情形由引擎推导即可（仅验证字段存在）
var txt = CFG.chartText(ch1, CFG.MODULES['fyear']);
ok('排盘文本含【年干为纲】段', /年干为纲/.test(txt));
ok('排盘文本含年命纳音', /纳音属土/.test(txt));
var txt2 = CFG.chartText(ch2, CFG.MODULES['fyear']);
ok('未填出生年提示按当年太岁', /按当年太岁/.test(txt2));
ok('fyear 标记 useYearShen', CFG.MODULES['fyear'].useYearShen === true);
ok('fweek 标记 useYearShen', CFG.MODULES['fweek'].useYearShen === true);

console.log('年干/年命 回归: ' + pass + ' 通过, ' + fail + ' 失败');
if (fail) { console.log('失败项: ' + fails.join(' | ')); process.exit(1); }
