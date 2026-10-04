// 代占识别测试：验证"所问之人≠自身"时切换太极点至对方六亲/应爻
var LY = require('../libs/liuyao.js');
var SYM = require('../libs/symbol_dict.js');

// 固定卦例：乾为天（金宫），世爻临父母
var g = LY.arrange({ six: [{ sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }], monthGanZhi: '丙寅', dayGanZhi: '甲子' });
var el = g.ben.info.element;

var pass = 0, fail = 0;
function check(name, got, exp) {
  var ok = (got === exp);
  if (ok) { pass++; } else { fail++; console.log('  ✗ ' + name + ' | 期望=' + exp + ' 实际=' + got); }
}

console.log('===== 代占：主用神切换至对方六亲 =====');
// 我妈病了 → 妈=父母(体)，病=官鬼(事象辅)
var r1 = SYM.resolveUseGod('general', '我妈病了严重吗', g);
check('我妈病了 main=父母', r1.main.lq, '父母');
check('我妈病了 source=代占', r1.source, '代占');
check('我妈病了 daiZhan=true', r1.daiZhan, true);
check('我妈病了 tiandi=父母', r1.tiandi, '父母');
check('我妈病了 aux 含官鬼(病象)', r1.aux.some(function (a) { return a.lq === '官鬼'; }), true);
check('我妈病了 不把官鬼立为主', r1.main.lq !== '官鬼', true);

// 我爸事业 → 爸=父母，事业=官鬼(辅)
var r2 = SYM.resolveUseGod('general', '我爸事业怎么样', g);
check('我爸事业 main=父母', r2.main.lq, '父母');
check('我爸事业 aux 含官鬼', r2.aux.some(function (a) { return a.lq === '官鬼'; }), true);

// 朋友借钱 → 朋友=兄弟，钱=妻财(辅)
var r3 = SYM.resolveUseGod('general', '朋友借钱能还吗', g);
check('朋友借钱 main=兄弟', r3.main.lq, '兄弟');
check('朋友借钱 aux 含妻财', r3.aux.some(function (a) { return a.lq === '妻财'; }), true);

// 我儿子考试 → 儿子=子孙，考试=父母(辅)
var r4 = SYM.resolveUseGod('general', '我儿子考试成绩好吗', g);
check('我儿子考试 main=子孙', r4.main.lq, '子孙');
check('我儿子考试 aux 含父母', r4.aux.some(function (a) { return a.lq === '父母'; }), true);

// 我老婆身体 → 老婆=妻财，身体=官鬼(辅)
var r5 = SYM.resolveUseGod('general', '我老婆身体不舒服', g);
check('我老婆身体 main=妻财', r5.main.lq, '妻财');
check('我老婆身体 aux 含官鬼', r5.aux.some(function (a) { return a.lq === '官鬼'; }), true);

// 老板难为我 → 老板=官鬼(男领导)
var r6 = SYM.resolveUseGod('general', '老板最近老为难我', g);
check('老板为难 main=官鬼', r6.main.lq, '官鬼');

// 对方/客户 → 应爻
var r7 = SYM.resolveUseGod('general', '客户会签这个合同吗', g);
check('客户签约 main=应爻', r7.main.lq, '应爻');
check('客户签约 daiZhan=true', r7.daiZhan, true);

console.log('===== 对照：非代占不触发 =====');
// 我自己病了 → 不触发代占，main=官鬼（问自身病）
var r8 = SYM.resolveUseGod('general', '我自己身体不舒服', g);
check('我自己病 source≠代占', r8.source === '代占', false);
check('我自己病 main=官鬼', r8.main.lq, '官鬼');
// 中性问句 → 世爻为纲
var r9 = SYM.resolveUseGod('general', '帮我看看运势', g);
check('中性 general source=世爻', r9.source, '世爻');
// 单问财（无亲属词）→ 妻财，非代占
var r10 = SYM.resolveUseGod('general', '最近财运怎么样', g);
check('问财 source≠代占', r10.source === '代占', false);
check('问财 main=妻财', r10.main.lq, '妻财');

console.log('===== 轴锁/校验对代占生效 =====');
var a1 = SYM.axisAnchor(g, 'general', '我妈病了严重吗');
check('我妈病了 轴锁锚用神=父母', a1.useLq, '父母');
var v1 = SYM.verifyAxis(g, 'general', a1.anchor, '我妈病了严重吗'); // 模型正确回抄锚句
check('我妈病了 校验通过(立父母)', v1.ok, true);
var v1b = SYM.verifyAxis(g, 'general', '用神＝官鬼（二爻），原神＝父母，忌神＝妻财。', '我妈病了严重吗'); // 误立官鬼(问病者非自身)
check('我妈病了 校验拒绝(误立官鬼)', v1b.ok, false);
var a7 = SYM.axisAnchor(g, 'general', '客户会签这个合同吗');
check('客户签约 轴锁锚=应爻', a7.useLq, '应爻');
check('客户签约 轴锁 yuan=null(应爻不套公式)', a7.yuan, null);
var v7 = SYM.verifyAxis(g, 'general', '用神＝应爻（对方），世应生克定吉凶。', '客户会签这个合同吗');
check('客户签约 校验通过(立应爻)', v7.ok, true);

console.log('===== useGodRelation 代占提示 =====');
var ug1 = SYM.useGodRelation(g, 'general', false, '我妈病了严重吗');
check('我妈病了 生克图含代占提示', ug1.indexOf('代占提示') >= 0, true);
check('我妈病了 生克图强调以父母为体', ug1.indexOf('以对方六亲「父母」为体') >= 0, true);
var ug7 = SYM.useGodRelation(g, 'general', false, '客户会签这个合同吗');
check('客户签约 生克图应爻专用文案', ug7.indexOf('应爻（对方/外境）') >= 0, true);

console.log('\n结果：通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
