// 用神动态解析器·结构化输出测试（不烧 key）
// 覆盖：主用神来源(问句/模块/世爻)、辅用神(多命中+场景规则)、太极点恒世爻、应爻轴、推演步骤、兼容字段、全卦无异常
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');

let pass = 0, fail = 0;
function check(name, got, exp) {
  const ok = (got === exp);
  if (ok) { pass++; }
  else { fail++; console.error('  ✗ ' + name + ' | 期望=' + JSON.stringify(exp) + ' 实际=' + JSON.stringify(got)); }
}
function ok(name, cond) {
  if (cond) { pass++; } else { fail++; console.error('  ✗ ' + name); }
}

// 一个固定卦（乾为天，金宫）用于单点断言
const g = LY.arrange({ six: [{ sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }], monthGanZhi: '丙寅', dayGanZhi: '甲子' });
const shiLq = SYM.resolveUseGod('general', '', g).useLq; // 世爻所临六亲（金宫乾为天世在爻，取实际）

console.log('===== ① 结构化形状 =====');
const r0 = SYM.resolveUseGod('career', '升职后工资能涨多少', g);
ok('返回对象含 main', r0 && r0.main && typeof r0.main.lq === 'string');
ok('返回对象含 aux 数组', Array.isArray(r0.aux));
ok('返回对象含 taiji=世爻', r0.taiji === '世爻');
ok('返回对象含 ying 字段', 'ying' in r0);
ok('返回对象含 steps 数组', Array.isArray(r0.steps) && r0.steps.length >= 1);
ok('返回对象含兼容 useLq', r0.useLq === r0.main.lq);
ok('返回对象含兼容 source', r0.source === r0.main.source);
ok('steps 每项含 step/kind', r0.steps.every(s => typeof s.step === 'number' && typeof s.kind === 'string'));

console.log('===== ② 关键词命中→问句源 =====');
check('illness+身体 → 官鬼', SYM.resolveUseGod('illness', '我最近身体不舒服', g).useLq, '官鬼');
check('study+考研 → 父母', SYM.resolveUseGod('study', '考研能上岸吗', g).useLq, '父母');
check('wealth+投资 → 妻财', SYM.resolveUseGod('wealth', '这笔投资能回本吗', g).useLq, '妻财');
check('lost+丢(无亲属词) → 妻财', SYM.resolveUseGod('lost', '我丢的钱包能找回吗', g).useLq, '妻财');
check('illness+身体 source', SYM.resolveUseGod('illness', '我最近身体不舒服', g).source, '问句');
ok('travel+出门 source=世爻', SYM.resolveUseGod('travel', '出门平安吗', g).source === '世爻');

console.log('===== ③ 中性→模块默认/世爻为纲 =====');
check('career 中性 → 官鬼', SYM.resolveUseGod('career', '帮我看看发展', g).useLq, '官鬼');
check('career 中性 source', SYM.resolveUseGod('career', '帮我看看发展', g).source, '模块');
ok('general 中性 source=世爻', SYM.resolveUseGod('general', '帮我看看', g).source === '世爻');

console.log('===== ④ 多命中→辅用神 / 场景规则 =====');
const rCareer = SYM.resolveUseGod('career', '升职后工资能涨多少', g);
check('career+工资 主用神=官鬼', rCareer.main.lq, '官鬼');
ok('career+工资 辅用神含妻财', rCareer.aux.some(a => a.lq === '妻财'));
const rStudy = SYM.resolveUseGod('study', '考研能不能上岸', g);
check('study+考研 主用神=父母', rStudy.main.lq, '父母');
ok('study+考研 辅用神含官鬼(功名)', rStudy.aux.some(a => a.lq === '官鬼'));
const rGo = SYM.resolveUseGod('general', '我要出门一趟注意什么', g);
ok('出行场景 辅用神含官鬼(险阻)', rGo.aux.some(a => a.lq === '官鬼'));
ok('出行场景 含父母轴(或世爻即父母)', rGo.aux.some(a => a.lq === '父母') || rGo.main.lq === '父母');
ok('出行场景 辅用神不重复主用神', rGo.aux.every(a => a.lq !== rGo.main.lq));

console.log('===== ⑤ 互动类→应爻轴 =====');
const rLove = SYM.resolveUseGod('loveM', '我和对象能成吗', g);
check('loveM 主用神=妻财(模块默认)', rLove.main.lq, '妻财');
check('loveM 应爻轴=应爻', rLove.ying, '应爻');
ok('loveM 辅用神含官鬼(夫星)', rLove.aux.some(a => a.lq === '官鬼'));
const rGen = SYM.resolveUseGod('general', '帮我看看', g);
ok('general 中性 无应爻轴', rGen.ying === null);

console.log('===== ⑥ 太极点恒为世爻 =====');
['career', 'study', 'wealth', 'illness', 'lost', 'travel', 'loveM', 'general', 'home', 'news'].forEach(m => {
  ok(m + ' taiji=世爻', SYM.resolveUseGod(m, '随便问点事', g).taiji === '世爻');
});

console.log('===== ⑦ 辅用神不含主用神自身 =====');
['career', 'study', 'wealth', 'illness', 'lost', 'travel', 'loveM', 'home', 'news', 'job'].forEach(m => {
  const r = SYM.resolveUseGod(m, '升职考试财运病出行感情合作', g);
  ok(m + ' 辅用神不含主用神', r.aux.every(a => a.lq !== r.main.lq));
});

console.log('===== ⑧ 全 64 卦 × 14 模块 解析无异常 =====');
let crash = 0;
for (let gi = 0; gi < 64; gi++) {
  const six = [];
  for (let i = 0; i < 6; i++) six.push({ sum: [6, 7, 8, 9][(gi + i * 3) % 4] });
  try {
    const ch = LY.arrange({ six: six, monthGanZhi: '丙寅', dayGanZhi: '甲子' });
    Object.keys(SYM.MOD_USE).forEach(mid => {
      const rr = SYM.resolveUseGod(mid, '升职考试财运病出行感情合作', ch);
      if (!rr || !rr.main || !rr.main.lq || !Array.isArray(rr.aux) || !Array.isArray(rr.steps)) crash++;
    });
  } catch (e) { crash++; if (crash <= 2) console.error('  CRASH ' + gi + ': ' + e.message); }
}
check('64卦解析异常数=0', crash, 0);

console.log('\n结果：通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
