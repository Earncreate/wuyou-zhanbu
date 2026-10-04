// 时辰应期回归：验证 shiChenYingqi 出场 + 候选含 值时/动值/冲空，且 hours/when 合理
const LY = require('../libs/liuyao.js');
const CFG = require('../libs/config.js');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg); } }

// 起一卦：月建丁酉，日辰戊申（旬空寅卯），时辰 戊申（申时起卦）
const chart = LY.arrange({
  yearGanZhi: '丙午', monthGanZhi: '丁酉', dayGanZhi: '戊申', hourGanZhi: '戊申',
  solarText: '2026-10-01 15:20', lunarText: '农历八月廿一', jieqi: '秋分',
  six: [
    { sum: 7 }, { sum: 7 }, { sum: 8 }, { sum: 7 }, { sum: 7 }, { sum: 8 }
  ]
});

ok(!!chart, 'arrange 出卦');
ok(!!chart.hourGanZhi, '时辰干支已落 chart (四柱齐全)');
ok(!!LY.shiChenYingqi, 'shiChenYingqi 已导出');

// 取一个用神爻（以妻财为例，找一个妻财爻）
const ysYao = chart.ben.yaos.filter(function (y) { return y.liuqin === '妻财'; })[0];
ok(!!ysYao, '存在妻财用神爻');

const sc = LY.shiChenYingqi(ysYao, chart);
ok(Array.isArray(sc) && sc.length > 0, '用神时辰候选非空');
ok(sc.some(function (c) { return c.tag === '值时'; }), '含 值时 候选');
const zhi = sc.filter(function (c) { return c.tag === '值时'; })[0];
ok(zhi.hours >= 0 && zhi.hours <= 11, '值时 hours 在 0..11 (' + zhi.hours + ')');
ok(/时/.test(zhi.when), '值时 when 含"时"字: ' + zhi.when);
ok(zhi.zhi === ysYao.zhi, '值时支=用神地支');

// 动爻应给 动值
const mvYao = chart.ben.yaos.filter(function (y) { return y.isMoving; })[0];
if (mvYao) {
  const sc2 = LY.shiChenYingqi(mvYao, chart);
  ok(sc2.some(function (c) { return c.tag === '动值'; }), '动爻含 动值 候选');
}

// 旬空爻（寅/卯）应给 冲空
const kongYao = chart.ben.yaos.filter(function (y) { return y.isKong; })[0];
if (kongYao) {
  const sc3 = LY.shiChenYingqi(kongYao, chart);
  ok(sc3.some(function (c) { return c.tag === '冲空'; }), '旬空爻含 冲空 候选');
}

// chartText 应含「候选时辰」段
const txt = CFG.chartText(chart, CFG.MODULES['wealth']);
ok(/候选时辰/.test(txt), 'chartText 含「候选时辰」应期段');

console.log('\n时辰应期回归: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
