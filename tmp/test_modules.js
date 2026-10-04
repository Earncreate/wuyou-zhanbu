// 六神分组模块注册表 + 通用问事模板拼装 回归
var path = require('path');
var LY = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'liuyao.js'));
var CFG = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'config.js'));
var P = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'prompts.js'));

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' → ' + String(extra).slice(0, 160) : '')); }
}

var IDS = Object.keys(CFG.MODULES);
var LQ = ['父母', '官鬼', '妻财', '子孙', '兄弟'];

// 1 分组覆盖：MOD_GROUPS 恰好覆盖全部模块、无重复无遗漏
var flat = [];
CFG.MOD_GROUPS.forEach(function (g) { g.ids.forEach(function (id) { flat.push(id); }); });
ok('分组无遗漏', IDS.every(function (id) { return flat.indexOf(id) >= 0; }), IDS.filter(function (id) { return flat.indexOf(id) < 0; }));
ok('分组无重复', flat.length === IDS.length, flat.length + ' vs ' + IDS.length);
ok('分组引用的模块都存在', flat.every(function (id) { return !!CFG.MODULES[id]; }), null);

// 2 每个模块的四六亲合法、问事模块字段齐备
var badRoles = IDS.filter(function (id) {
  var m = CFG.MODULES[id];
  return LQ.indexOf(m.yongshen) < 0 || LQ.indexOf(m.yuanshen) < 0 || LQ.indexOf(m.jishen) < 0 || LQ.indexOf(m.choushen) < 0;
});
ok('全部模块用神/原神/忌神/仇神合法', !badRoles.length, badRoles);

var shenMods = IDS.filter(function (id) { return CFG.MODULES[id].shen; });
ok('六神组模块的 shen 均在六神纲内', shenMods.every(function (id) { return !!CFG.SHEN_DOMAIN[CFG.MODULES[id].shen]; }), null);
ok('六神纲六神齐全', ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'].every(function (s) { return CFG.SHEN_DOMAIN[s] && CFG.SHEN_DOMAIN[s].lens; }), null);
ok('问事模块均有 focus 与 yingDesc', IDS.filter(function (id) { return CFG.MODULES[id].useGeneral; })
  .every(function (id) { return CFG.MODULES[id].focus && CFG.MODULES[id].yingDesc; }), null);

// 3 chartText 对全部模块可用：无 undefined、有用神取用
var chart = LY.arrange({
  yearGanZhi: '丙午', monthGanZhi: '丁酉', dayGanZhi: '戊申', hourGanZhi: '己未',
  six: [{ sum: 7 }, { sum: 9 }, { sum: 9 }, { sum: 6 }, { sum: 7 }, { sum: 8 }]
});
var badText = [];
IDS.forEach(function (id) {
  var t = CFG.chartText(chart, CFG.MODULES[id]);
  if (t.indexOf('undefined') >= 0 || t.indexOf('【用神取用】') < 0) badText.push(id);
});
ok('chartText 对全部 ' + IDS.length + ' 个模块可用且无 undefined', !badText.length, badText);

// 4 注入点抽查
var tLove = CFG.chartText(chart, CFG.MODULES.loveM);
ok('感情婚姻·男占 注入六神纲（青龙）', tLove.indexOf('【六神纲】本占属「青龙」') >= 0, null);
ok('问事模块六神回退到纲定性（主喜庆）', tLove.indexOf('主喜庆') >= 0, null);
ok('问事模块用上模块专属六亲取象', tLove.indexOf('在感情婚姻·男占中取象为') >= 0, null);
var tGen0 = CFG.chartText(chart, CFG.MODULES.general);
ok('无专属取象的模块落问事通用层（妻财＝所问之钱财货物）', tGen0.indexOf('所问之钱财货物') >= 0, null);
var stillClassic = IDS.filter(function (id) {
  var m = CFG.MODULES[id];
  if (!m.useGeneral) return false;
  return CFG.chartText(chart, m).indexOf('按传统类象直解') >= 0;
});
ok('问事模块不再直落传统类象（均有取象层）', !stillClassic.length, stillClassic);
ok('问事模块六神有宜忌（走问事六神层）', tLove.indexOf('｜宜') >= 0, null);
var SEM = CFG.LIUQIN_SEMANTIC;
ok('失物占 妻财＝所失之物', SEM.lost && SEM.lost.妻财.xiang.indexOf('所失之物') >= 0, null);
ok('疾病占 官鬼＝病症', SEM.illness && SEM.illness.官鬼.xiang.indexOf('病症') >= 0, null);
ok('疾病占 子孙＝医药', SEM.illness && SEM.illness.子孙.xiang.indexOf('医药') >= 0, null);
ok('学业占 父母＝成绩文书', SEM.study && SEM.study.父母.xiang.indexOf('成绩') >= 0, null);
ok('官司占 子孙＝和解之门', SEM.lawsuit && SEM.lawsuit.子孙.xiang.indexOf('和解') >= 0, null);
ok('出行占 官鬼＝凶险阻滞', SEM.travel && SEM.travel.官鬼.xiang.indexOf('凶险') >= 0, null);
ok('男占 妻财＝对方', SEM.loveM && SEM.loveM.妻财.xiang.indexOf('对方') >= 0, null);
ok('女占 官鬼＝对方', SEM.loveF && SEM.loveF.官鬼.xiang.indexOf('对方') >= 0, null);
ok('家宅占 官鬼＝不安之方', SEM.home && SEM.home.官鬼.xiang.indexOf('不安') >= 0, null);
ok('财运占 兄弟＝劫财破耗', SEM.wealth && SEM.wealth.兄弟.xiang.indexOf('破耗') >= 0, null);
ok('问事通用层 五六亲齐全', ['妻财', '官鬼', '父母', '子孙', '兄弟'].every(function (k) { return CFG.LIUQIN_QA[k] && CFG.LIUQIN_QA[k].yi && CFG.LIUQIN_QA[k].ji; }), null);
ok('问事六神层 六神齐全', ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'].every(function (s) { return CFG.SHEN_QA[s] && CFG.SHEN_QA[s].yi && CFG.SHEN_QA[s].ji; }), null);
ok('男占用神＝妻财', CFG.MODULES.loveM.yongshen === '妻财', null);
ok('女占用神＝官鬼', CFG.MODULES.loveF.yongshen === '官鬼', null);
var tGen = CFG.chartText(chart, CFG.MODULES.general);
ok('通用问事 注入取用说明', tGen.indexOf('取用说明：') >= 0, null);
var tWealth = CFG.chartText(chart, CFG.MODULES.wealth);
ok('财运 注入断卦要点', tWealth.indexOf('【本模块断卦要点】') >= 0, null);
var tIll = CFG.chartText(chart, CFG.MODULES.illness);
ok('疾病 注入事理之忌说明', tIll.indexOf('事理之忌') >= 0, null);

// 5 提示词拼装：问事模块走 QUESTION_AGENT + 六神纲 + focus，生活模块保持原样
ok('问事模块各有专属占卜提示词（非通用主体）', P.get('wealth') === P.MODULE_AGENTS.wealth && P.get('wealth') !== P.QUESTION_AGENT, null);
var qaIds = IDS.filter(function (id) { return CFG.MODULES[id].useGeneral; });
var noOwn = qaIds.filter(function (id) { return !P.MODULE_AGENTS[id] || P.get(id) === P.QUESTION_AGENT; });
ok(qaIds.length + ' 个问事模块全部有专属提示词', !noOwn.length, noOwn);
var thinAgent = qaIds.filter(function (id) {
  var a = P.MODULE_AGENTS[id];
  return !a || a.length < 400 || a.indexOf('# 本占取用') < 0 || a.indexOf('# 断卦章法') < 0 || a.indexOf('# 输出流程（SOP）') < 0;
});
ok('每个专属提示词含取用/章法/SOP 三节且篇幅达标', !thinAgent.length, thinAgent);
ok('疾病占专属章法：官鬼为病症、子孙为医药', P.MODULE_AGENTS.illness.indexOf('官鬼＝病症') >= 0 && P.MODULE_AGENTS.illness.indexOf('子孙（医药') >= 0, null);
ok('行人占专属章法：用神动则已动身', P.MODULE_AGENTS.person.indexOf('人已动身') >= 0, null);
ok('失物占专属章法：玄武定方位', P.MODULE_AGENTS.lost.indexOf('玄武') >= 0 && P.MODULE_AGENTS.lost.indexOf('藏匿方位') >= 0, null);
ok('家宅占专属章法：爻位定方位', P.MODULE_AGENTS.home.indexOf('爻位定位') >= 0, null);
ok('年运占专属章法：太岁与世爻', P.MODULE_AGENTS.fyear.indexOf('太岁') >= 0, null);
ok('各模块提示词互不相同', (function () {
  var seen = {}, dup = 0;
  IDS.forEach(function (id) {
    var a = P.get(id);
    if (seen[a]) dup++; else seen[a] = 1;
  });
  return dup === 0;
})(), null);
ok('生活模块保持专属顾问', P.get('diet') === P.DIET_AGENT && P.get('sport') === P.SPORT_AGENT && P.get('fun') === P.FUN_AGENT, null);

var m2 = CFG.buildStage2Messages('wealth', '最近生意不好', chart, '（总断文本）');
ok('Stage2 系统词注入六神纲', m2[0].content.indexOf('本占六神纲（青龙）') >= 0, null);
ok('Stage2 系统词注入断卦要点', m2[0].content.indexOf('本模块断卦要点') >= 0, null);
ok('无 dims 模块不要求属性匹配表', m2[3].content.indexOf('关键依据表') >= 0, m2[3].content.slice(0, 80));
var mDiet = CFG.buildStage2Messages('diet', '吃什么好', chart, '（总断文本）');
ok('diet 仍要求属性匹配表', mDiet[3].content.indexOf('属性匹配表') >= 0, null);

var m1 = CFG.buildStage1Messages('fyear', '今年运势如何', chart);
ok('新模块 Stage1 构造可用', m1[1].content.indexOf('终身运/年运') >= 0 && m1[1].content.indexOf('【日月力量·逐爻') >= 0, null);

// 6 语气与风险约束：每个问事模块都有，高风险模块措辞到位
var noRisk = IDS.filter(function (id) { return CFG.MODULES[id].useGeneral && !CFG.RISK_NOTE[id]; });
ok('每个问事模块都有语气与风险条款', !noRisk.length, noRisk);
var sysIll = CFG.buildStage2Messages('illness', '我最近不舒服', chart, '（总断）')[0].content;
ok('疾病占系统词含禁诊断约束', sysIll.indexOf('不得给出诊断结论') >= 0, null);
var sysNum = CFG.buildStage2Messages('num', '这组号码如何', chart, '（总断）')[0].content;
ok('号码占系统词声明趣味推演', sysNum.indexOf('趣味推演') >= 0, null);
var sysLaw = CFG.buildStage2Messages('lawsuit', '这官司能赢吗', chart, '（总断）')[0].content;
ok('官司占系统词声明非法律意见', sysLaw.indexOf('不构成法律意见') >= 0, null);
ok('风险条款同时进入排盘文本', CFG.chartText(chart, CFG.MODULES.travel).indexOf('【本模块语气与风险约束】') >= 0, null);

// 7 默认问法与选填栏：模块各自的问题，不再统一"脾胃"
var missAsk = IDS.filter(function (id) { return !CFG.ASK_DEFAULT[id]; });
ok('全部模块都有默认问法', !missAsk.length, missAsk);
ok('未填写时回退默认问法', CFG.askText('wealth', '') === CFG.ASK_DEFAULT.wealth, CFG.askText('wealth', ''));
ok('填写时优先用户原文', CFG.askText('wealth', '货款何时回') === '货款何时回', null);
ok('选填栏提示语按模块区分', CFG.askPlaceholder('loveM').indexOf('她对我的态度') >= 0, CFG.askPlaceholder('loveM'));
ok('选填栏不再出现统一的脾胃例子', CFG.askPlaceholder('sport').indexOf('脾胃') < 0, CFG.askPlaceholder('sport'));
var tAsk = CFG.chartText(chart, CFG.MODULES.loveM);
ok('注入应期候选日（含距今天数）', tAsk.indexOf('【应期提示·候选日') >= 0 && tAsk.indexOf('距今第') >= 0, null);
ok('应期按距今天数排序并标出最近一个', tAsk.indexOf('★') >= 0 && tAsk.indexOf('最近一个应期') >= 0, null);
ok('应期天数换算正确（申日辰起算）', /距今第 \d+ 天/.test(tAsk), null);
ok('注入用神两现取舍', tAsk.indexOf('用神两现') >= 0, null);
ok('过强约束已改为防错表述', tAsk.indexOf('不得无声推翻') >= 0 && tAsk.indexOf('必须与此节分数与结论一致') < 0, null);
var cKong = LY.arrange({ monthGanZhi: '丁酉', dayGanZhi: '丁卯', six: [{ sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }] });
ok('世应空破约束进入排盘文本（世爻旬空卦例）', CFG.chartText(cKong, CFG.MODULES.general).indexOf('只作趋势参考') >= 0, null);

console.log('\n模块注册表回归: 通过 ' + pass + ' 项, 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
