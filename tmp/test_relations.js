// 校验：六合 / 六冲 / 三合三会 / 刑害破 / 墓库 / 空亡 / 神煞 / 卦变 / 飞伏
var path = require('path');
var LY = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'liuyao.js'));

var pass = 0, fail = 0;
function ok(name, cond, got) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' → ' + JSON.stringify(got)); }
}

// 1. 六合
var he = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];
he.forEach(function (p) {
  ok('六合 ' + p[0] + p[1], LY.LIU_HE[p[0]] === p[1] && LY.LIU_HE[p[1]] === p[0]);
});
// 六冲
[['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']].forEach(function (p) {
  ok('六冲 ' + p[0] + p[1], LY.CHONG[p[0]] === p[1] && LY.CHONG[p[1]] === p[0]);
});
// 相害 / 相破 / 墓库
ok('相害 子未', LY.HAI['子'] === '未' && LY.HAI['未'] === '子');
ok('相害 酉戌', LY.HAI['酉'] === '戌');
ok('相破 寅亥（既合又破）', LY.PO['寅'] === '亥' && LY.LIU_HE['寅'] === '亥');
ok('相破 巳申（既合又刑又破）', LY.PO['巳'] === '申' && LY.LIU_HE['巳'] === '申');
ok('墓库 木墓未', LY.MU_KU['木'] === '未');
ok('墓库 火墓戌', LY.MU_KU['火'] === '戌');
ok('墓库 金墓丑', LY.MU_KU['金'] === '丑');
ok('墓库 水土墓辰', LY.MU_KU['水'] === '辰' && LY.MU_KU['土'] === '辰');

// 2. 乾为天（甲子日、寅月）实测
var c = LY.arrange({
  monthGanZhi: '丙寅', dayGanZhi: '甲子',
  six: [{ sum: 9 }, { sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }]
});
var r = LY.analyzeRelations(c);

ok('乾为天判为六冲卦', r.guaBian.indexOf('本卦六冲') >= 0, r.guaBian);
// 空破之支不入局：乾为天例中五爻申被寅月冲（月破）、上爻戌在甲子旬空，故两局均不成
ok('申子辰水局不成（五爻申月破）', r.ju.some(function (j) { return j.type === '三合局（不成）' && j.zhi === '申子辰' && /月破/.test(j.note); }), r.ju);
ok('寅午戌火局不成（上爻戌旬空）', r.ju.some(function (j) { return j.type === '三合局（不成）' && j.zhi === '寅午戌' && /旬空/.test(j.note); }), r.ju);
ok('寅辰拱卯（拱合）', r.gonghe.some(function (g) { return g.zhi === '寅辰'; }), r.gonghe);

// 神煞：日支子 → 驿马寅、桃花酉；日干甲 → 贵人丑未、羊刃卯
ok('驿马寅', r.shensha.yiMa === '寅', r.shensha.yiMa);
ok('桃花酉', r.shensha.taoHua === '酉', r.shensha.taoHua);
ok('贵人丑未', r.shensha.guiRen.join('/') === '丑/未', r.shensha.guiRen);
ok('羊刃卯', r.shensha.yangRen === '卯', r.shensha.yangRen);

// 逐爻：初爻子与四爻午六冲；五爻申月破；上爻戌旬空；三爻辰自刑
function tagsOf(pos) {
  var o = r.yao.filter(function (x) { return x.pos === pos; })[0];
  return o ? o.tags.join('；') : '';
}
ok('初爻子 与四爻午六冲', tagsOf(1).indexOf('与四爻午六冲') >= 0, tagsOf(1));
ok('五爻申 月建寅相冲（月破）', tagsOf(5).indexOf('月破') >= 0, tagsOf(5));
ok('上爻戌 旬空（甲子旬空戌亥）', tagsOf(6).indexOf('旬空') >= 0, tagsOf(6));
ok('三爻辰 自刑', tagsOf(3).indexOf('自刑') >= 0, tagsOf(3));

// 飞伏：八纯卦伏神与飞神同位比和
ok('飞伏 有六条', r.feiFu.length === 6, r.feiFu.length);
ok('飞伏 比和（纯卦）', r.feiFu.every(function (f) { return f.rel.indexOf('比和') >= 0; }), r.feiFu[0]);

console.log('\n合冲刑害破等规则校验: 通过 ' + pass + ' 项, 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
