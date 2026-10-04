// 日月力量引擎回归：水天需（丙午年 丁酉月 戊申日 己未时，二三四爻动）
var path = require('path');
var LY = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'liuyao.js'));

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' → ' + JSON.stringify(extra) : '')); }
}

var chart = LY.arrange({
  yearGanZhi: '丙午', monthGanZhi: '丁酉', dayGanZhi: '戊申', hourGanZhi: '己未',
  solarText: '2026-10-01 13:41', lunarText: '八月十一', jieqi: '秋分',
  six: [{ sum: 7 }, { sum: 9 }, { sum: 9 }, { sum: 6 }, { sum: 7 }, { sum: 8 }]
});

console.log('本卦：' + chart.ben.name + '　变卦：' + (chart.bian ? chart.bian.name : '无'));
console.log('月建：' + chart.monthZhi + '　日辰：' + chart.dayZhi + '　旬空：' + chart.xunkong.join('、') + '　月破：' + chart.yuepo);
console.log('世在' + chart.ben.info.shi + '爻，应在' + chart.ben.info.ying + '爻\n');

// 1 月建层：旺相休囚死映射（同我旺 / 月生相 / 爻生月休 / 爻克月囚 / 月克死）
ok('月建层 申金(月酉金同气)=旺', LY.monthLayer('申', '酉').state === '旺', LY.monthLayer('申', '酉'));
ok('月建层 酉金=旺', LY.monthLayer('酉', '酉').state === '旺', LY.monthLayer('酉', '酉'));
ok('月建层 子水(月酉金生水)=相', LY.monthLayer('子', '酉').state === '相', LY.monthLayer('子', '酉'));
ok('月建层 丑土(土生金=爻生月)=休', LY.monthLayer('丑', '酉').state === '休', LY.monthLayer('丑', '酉'));
ok('月建层 午火(火克金=爻克月)=囚', LY.monthLayer('午', '酉').state === '囚', LY.monthLayer('午', '酉'));
ok('月建层 寅木(酉金克木=月克爻)=死', LY.monthLayer('寅', '酉').state === '死', LY.monthLayer('寅', '酉'));
ok('月建层 卯木(酉金克木=月克爻)=死', LY.monthLayer('卯', '酉').state === '死', LY.monthLayer('卯', '酉'));
ok('月建层 卯逢酉冲=月破', LY.monthLayer('卯', '酉').flags.indexOf('月破') >= 0, LY.monthLayer('卯', '酉'));
ok('月建层 辰逢酉合=月合', LY.monthLayer('辰', '酉').flags.indexOf('月合') >= 0, LY.monthLayer('辰', '酉'));

// 2 日辰层：临/生/克/合/暗动/日破/墓/绝
ok('日辰层 申临日=日临(+4)', LY.dayLayer('申', '申', false, '旺').flags.indexOf('日临') >= 0, LY.dayLayer('申', '申', false, '旺'));
ok('日辰层 子水(申金生水)=日生', LY.dayLayer('子', '申', false, '旺').flags.indexOf('日生') >= 0, LY.dayLayer('子', '申', false, '旺'));
ok('日辰层 寅木(申金克木)=日克', LY.dayLayer('寅', '申', false, '旺').flags.indexOf('日克') >= 0, LY.dayLayer('寅', '申', false, '旺'));
ok('日辰层 巳(申合巳)=日合', LY.dayLayer('巳', '申', false, '旺').flags.indexOf('日合') >= 0, LY.dayLayer('巳', '申', false, '旺'));
ok('日辰层 寅静爻旺相逢申冲=暗动', LY.dayLayer('寅', '申', false, '旺').flags.indexOf('暗动') >= 0, LY.dayLayer('寅', '申', false, '旺'));
ok('日辰层 寅静爻休囚逢申冲=日破', LY.dayLayer('寅', '申', false, '死').flags.indexOf('日破') >= 0, LY.dayLayer('寅', '申', false, '死'));
ok('日辰层 金墓在丑→日申不墓', LY.dayLayer('酉', '申', false, '旺').flags.indexOf('日墓') < 0, LY.dayLayer('酉', '申', false, '旺'));
ok('日辰层 水墓在辰→日辰时水爻日墓', LY.dayLayer('子', '辰', false, '旺').flags.indexOf('日墓') >= 0, LY.dayLayer('子', '辰', false, '旺'));
ok('日辰层 木绝在申→寅木逢申日=日绝', LY.dayLayer('寅', '申', false, '旺').flags.indexOf('日绝') >= 0, LY.dayLayer('寅', '申', false, '旺'));
ok('日辰层 金长生在巳→酉金逢巳日=日长生', LY.dayLayer('酉', '巳', false, '旺').flags.indexOf('日长生') >= 0, LY.dayLayer('酉', '巳', false, '旺'));
ok('日辰层 金帝旺在酉→酉金逢酉日同时日临', LY.dayLayer('酉', '酉', false, '旺').flags.indexOf('日临') >= 0, null);

// 3 空亡层
var fakeYao = { isKong: true, isYuePo: false, zhi: '寅' };
ok('空亡 休囚无日扶=真空', LY.kongResolve(fakeYao, '死', [], false).state === '真空', LY.kongResolve(fakeYao, '死', [], false));
ok('空亡 旺相=假空', LY.kongResolve(fakeYao, '旺', [], false).state === '假空', LY.kongResolve(fakeYao, '旺', [], false));
ok('空亡 日冲=冲空出空', LY.kongResolve(fakeYao, '死', ['暗动'], false).state === '冲空出空', LY.kongResolve(fakeYao, '死', ['暗动'], false));
ok('空亡 空+月破=真空', LY.kongResolve({ isKong: true, isYuePo: true, zhi: '卯' }, '旺', [], false).state === '真空', null);
ok('空亡 动空=动空待出旬', LY.kongResolve(fakeYao, '旺', [], true).state === '动空', LY.kongResolve(fakeYao, '旺', [], true));

// 4 日月救应：月破得日救 / 真破
var c2 = LY.arrange({
  monthGanZhi: '丁酉', dayGanZhi: '戊申', yearGanZhi: '丙午', hourGanZhi: '己未',
  six: [{ sum: 7 }, { sum: 9 }, { sum: 9 }, { sum: 6 }, { sum: 7 }, { sum: 8 }]
});
ok('日月救应已计算', !!(c2.riyue && c2.riyue.notes), null);
console.log('\n日月关系提示：');
(c2.riyue.notes || []).forEach(function (n) { console.log('  · ' + n); });

// 5 逐爻综合力量
console.log('\n逐爻日月力量（月建酉·日辰申）：');
c2.ben.yaos.forEach(function (y) {
  var s = y.wang;
  console.log('  ' + y.posName + ' ' + y.ganzhi + '（' + y.wuxing + '·' + y.liuqin + '）' +
    (y.isMoving ? '[动]' : '    ') + ' 合计 ' + s.score + '（' + s.level + '）　' + s.marks.join('、'));
  ok(y.posName + ' 力量对象结构完整', typeof s.score === 'number' && !!s.level && !!s.monthState, s);
});

// 6 月破爻是否被日救改写（本例月破=卯，卦中是否有卯）
var poYao = c2.ben.yaos.filter(function (y) { return y.isYuePo; })[0];
if (poYao) {
  console.log('\n月破爻：' + poYao.posName + poYao.ganzhi + ' → ' + (c2.riyue.rescue[poYao.pos] || {}).state);
  ok('月破爻有救应判定', !!c2.riyue.rescue[poYao.pos], null);
} else {
  console.log('\n本卦无月破爻（月破卯不在卦中）');
}

// 7 比较层
var cmp = LY.compareRoles(c2, { yongshen: '妻财', jishen: '兄弟', yuanshen: '子孙' });
ok('比较层可用', !!cmp && Array.isArray(cmp.verdict), null);
console.log('\n比较（用神妻财/忌神兄弟/原神子孙）：');
console.log('  用神 ' + (cmp.ysScore) + '　忌神 ' + (cmp.jsScore) + '　原神 ' + (cmp.yuanScore) +
  '　世 ' + (cmp.shiScore) + '　应 ' + (cmp.yingScore));
cmp.verdict.forEach(function (v) { console.log('  · ' + v); });

// 8 双应爻回归：火地晋（世四应初）变坤为地，变卦不标世应
var c3 = LY.arrange({
  monthGanZhi: '丁酉', dayGanZhi: '戊申', yearGanZhi: '丙午', hourGanZhi: '己未',
  six: [{ sum: 8 }, { sum: 8 }, { sum: 8 }, { sum: 9 }, { sum: 8 }, { sum: 9 }]
});
ok('火地晋 本卦', c3.ben.name === '火地晋', c3.ben.name);
ok('火地晋 世四应初', c3.ben.info.shi === 4 && c3.ben.info.ying === 1, c3.ben.info);
ok('变卦为坤为地', !!(c3.bian && c3.bian.name === '坤为地'), c3.bian && c3.bian.name);
ok('变卦爻不标世应（无双应）', c3.bian.yaos.every(function (y) { return !y.shiTag && !y.isShi && !y.isYing; }), c3.bian.yaos.map(function (y) { return y.shiTag; }));
ok('水天需case 变卦也不标世应', c2.bian.yaos.every(function (y) { return !y.shiTag; }), null);
ok('本卦世爻发动仍带世标', (function () { var y = c3.ben.yaos[3]; return y.isShi && y.isMoving && y.shiTag === '世'; })(), c3.ben.yaos[3]);

// 9 用神两现：水天需用神妻财两现（初爻甲子、上爻戊子），按动＞持世＞旺相取舍
ok('用神两现被识别', !!(cmp.shuangXian && cmp.shuangXian.count === 2), cmp.shuangXian);
ok('两现有取舍理由', !!(cmp.shuangXian && cmp.shuangXian.reason && cmp.shuangXian.chosen), cmp.shuangXian);
ok('取舍与所选用神一致', !!(cmp.shuangXian && cmp.shuangXian.chosen.indexOf(cmp.yongshen.ganzhi) >= 0), cmp.shuangXian);

// 10 世应空破：乾为天（世六壬戌）逢丁卯日，戌亥空 → 世爻旬空
var c4 = LY.arrange({ monthGanZhi: '丁酉', dayGanZhi: '丁卯', six: [{ sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }] });
var cmp4 = LY.compareRoles(c4, { yongshen: '妻财', jishen: '兄弟', yuanshen: '子孙' });
ok('乾为天 世爻为壬戌', c4.ben.yaos[5].ganzhi === '壬戌' && c4.ben.yaos[5].isShi, c4.ben.yaos[5].ganzhi);
ok('世爻旬空被判定（我方无力只作趋势）', (cmp4.shiYingKongPo || []).some(function (s) { return s.indexOf('世爻') >= 0 && s.indexOf('旬空') >= 0; }), cmp4.shiYingKongPo);
ok('空破进入比较结论', (cmp4.verdict || []).some(function (s) { return s.indexOf('旬空') >= 0; }), cmp4.verdict);

// 11 应期候选：初爻甲子（水）——逢值子、逢合丑、逢生申酉
var yq = LY.yingqiOf(c2.ben.yaos[0], c2);
ok('应期含逢值', yq.some(function (c) { return c.tag === '逢值' && c.zhi === '子'; }), yq);
ok('应期含逢合（子合丑）', yq.some(function (c) { return c.tag === '逢合' && c.zhi === '丑'; }), yq);
ok('应期含逢生（金生水：申酉）', yq.some(function (c) { return c.tag === '逢生' && (c.zhi === '申' || c.zhi === '酉'); }), yq);
var yq2 = LY.yingqiOf({ posName: '三爻', zhi: '寅', wuxing: '木', isKong: true, isYuePo: false, wang: { marks: ['旬空·假空'] } }, c2);
ok('旬空爻应期含冲空与出旬', yq2.some(function (c) { return c.tag === '冲空' && c.zhi === '申'; }) && yq2.some(function (c) { return c.tag === '出旬'; }), yq2);
var yq3 = LY.yingqiOf({ posName: '初爻', zhi: '卯', wuxing: '木', isKong: false, isYuePo: true, wang: { marks: [] } }, c2);
ok('月破爻应期含出月与合破', yq3.some(function (c) { return c.tag === '出月'; }) && yq3.some(function (c) { return c.tag === '合破' && c.zhi === '戌'; }), yq3);

console.log('\n日月力量引擎回归: 通过 ' + pass + ' 项, 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
