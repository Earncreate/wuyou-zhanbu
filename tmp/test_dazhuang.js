// 用户实测卦例回归：雷天大壮 2026-09-30 酉月丁未日，五爻乱动（初二四五上动，三爻静）
// 覆盖：三合成局条件（空破不成局）/ 本变爻回头合刑破 / 自刑单见修正 / 用神在局提示 / 多爻乱动提示
var path = require('path');
var LY = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'liuyao.js'));
var CFG = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'config.js'));

var pass = 0, fail = 0;
function ok(name, cond, got) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' → ' + JSON.stringify(got)); }
}

// 大壮：下乾(阳阳阳)上震(阳阴阴)；初9动、二9动、三7静、四9动、五6动、上6动
var c = LY.arrange({
  monthGanZhi: '丁酉', dayGanZhi: '丁未',
  six: [{ sum: 9 }, { sum: 9 }, { sum: 7 }, { sum: 9 }, { sum: 6 }, { sum: 6 }]
});

ok('排盘：本卦雷天大壮', c.ben.name === '雷天大壮', c.ben.name);
ok('排盘：变卦风山渐', c.bian.name === '风山渐', c.bian.name);
ok('排盘：动爻数5', c.movingCount === 5, c.movingCount);
ok('排盘：旬空寅卯', c.xunkong.join('') === '寅卯', c.xunkong);
ok('排盘：三爻甲辰（纳甲正确）', c.ben.yaos[2].ganzhi === '甲辰', c.ben.yaos[2].ganzhi);

var r = LY.analyzeRelations(c);

// 1. 三合成局条件
var juHuo = r.ju.filter(function (j) { return j.wx === '火'; })[0];
var juShui = r.ju.filter(function (j) { return j.wx === '水' && j.type === '三合局'; })[0];
ok('寅午戌火局不成（二爻寅旬空休囚）', juHuo && juHuo.type === '三合局（不成）', juHuo);
ok('申子辰水局成', !!juShui, r.ju);
ok('水局成员含爻位标注（初爻子/五爻申动/三爻辰）', juShui && /初爻子/.test(juShui.note) && /五爻申\(动\)/.test(juShui.note) && /三爻辰/.test(juShui.note), juShui && juShui.note);
ok('申酉戌三会金局成（酉为月建）', r.ju.some(function (j) { return j.type === '三会方局' && j.zhi === '申酉戌' && /月建/.test(j.note); }), r.ju);

// 2. 本↔变爻回头合 / 回头刑（huaRelation）
function huaOf(pos) {
  var y = c.ben.yaos[pos - 1], by = c.bian.yaos[pos - 1];
  return CFG.huaRelation(y, by);
}
ok('五爻申化巳：化回头合（巳申合绊原神）', huaOf(5).some(function (t) { return t.indexOf('化回头合') >= 0; }), huaOf(5));
ok('五爻申化巳：化回头刑（巳刑申）', huaOf(5).some(function (t) { return t.indexOf('化回头刑') >= 0; }), huaOf(5));
ok('四爻午化未：化回头合（午未合绊世爻）', huaOf(4).some(function (t) { return t.indexOf('化回头合') >= 0; }), huaOf(4));
ok('上爻戌化卯：化回头合（卯戌合绊忌神）', huaOf(6).some(function (t) { return t.indexOf('化回头合') >= 0; }), huaOf(6));
ok('上爻戌化卯：仍保留化回头克', huaOf(6).some(function (t) { return t.indexOf('回头克') >= 0; }), huaOf(6));
ok('初爻子化辰：化回头克+化墓（原有功能不回归）', huaOf(1).some(function (t) { return t.indexOf('回头克') >= 0; }) && huaOf(1).some(function (t) { return t.indexOf('化墓') >= 0; }), huaOf(1));

// 3. 自刑单见修正（本卦内辰、午各只一见）
ok('三爻辰：单见不成刑，只标自刑之性', r.yao[2].tags.some(function (t) { return t.indexOf('带自刑之性') >= 0; }) && !r.yao[2].tags.some(function (t) { return t.indexOf('自刑成') >= 0; }), r.yao[2].tags);
ok('四爻午：单见不成刑', r.yao[3].tags.some(function (t) { return t.indexOf('带自刑之性') >= 0; }), r.yao[3].tags);

// 4. chartText 注入层
var t = CFG.chartText(c, CFG.MODULES.diet);
ok('注入：★用神在局提示（妻财子水在申子辰水局内）', /★用神在局/.test(t) && /妻财/.test(t), t.split('\n').filter(function (l) { return /★用神在局/.test(l); }));
ok('注入：多爻乱动提示（5爻动≥4）', /【多爻乱动】本卦5个爻发动/.test(t), t.split('\n').filter(function (l) { return /多爻乱动/.test(l); }));
ok('注入：火局不成理由可读', /局气不真|不成局/.test(t), t.split('\n').filter(function (l) { return /寅午戌/.test(l); }));

// 5. 浏览器通道模拟（无 require 环境，防 UMD 回归）
var fs = require('fs'), vm = require('vm');
var ctx = vm.createContext({ window: {}, localStorage: { getItem: function () { return null; }, setItem: function () {} }, console: console, setTimeout: setTimeout });
var loadErr = null;
try {
  ['liuyao', 'prompts', 'config'].forEach(function (f) { vm.runInContext(fs.readFileSync('libs/' + f + '.js', 'utf8'), ctx); });
} catch (e) { loadErr = e; }
ok('浏览器通道：libs 三件无 require 加载不报错', !loadErr, loadErr && loadErr.message);
ok('浏览器通道：AppConfig 挂载且分析可用', !!(ctx.AppConfig && ctx.AppConfig.huaRelation && ctx.AppConfig.MODULES.diet), null);

console.log('\n大壮卦例回归: 通过 ' + pass + ' 项, 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
