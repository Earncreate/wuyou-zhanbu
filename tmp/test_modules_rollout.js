// 用神动态解析器·逐模块落地回归（不烧 key）
// 目标：把 resolveUseGod（所问即取用）真正"落实"到全部 22 个模块——
//   每个模块跑 ①领域问句 ②中性/默认 ③(如有)问句越界覆盖 ④(如有)代占，
//   并走完整管线 resolveUseGod→modRoles→chartText→axisAnchor→轴锁校验，
//   验证用神正确、轴锁三层（锚句/回抄/校验）对每模块生效、全卦无异常。
const path = require('path');
const LY = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'liuyao.js'));
const SYM = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'symbol_dict.js'));
const CFG = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'config.js'));

const LQ = ['父母', '官鬼', '妻财', '子孙', '兄弟'];
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.error('  ✗ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 140) : '')); }
}
function eq(name, got, exp) {
  const cond = (got === exp);
  if (cond) { pass++; } else { fail++; console.error('  ✗ ' + name + ' | 期望=' + JSON.stringify(exp) + ' 实际=' + JSON.stringify(got)); }
}

// 固定一组有代表性的卦（覆盖不同卦宫五行，验证原神/忌神随宫变）
const CHART = LY.arrange({ yearGanZhi: '丙午', monthGanZhi: '丁酉', dayGanZhi: '戊申', hourGanZhi: '己未',
  six: [{ sum: 7 }, { sum: 9 }, { sum: 9 }, { sum: 6 }, { sum: 7 }, { sum: 8 }] });
const PALACE = CHART.ben.info.element;
console.log('测试卦宫：' + CHART.ben.name + '（' + PALACE + '宫）');

// ===== 逐模块用例 =====
// expect 形式：'妻财' 等具体六亲；或 {src:'世爻'} 表示走世爻为纲（主用神=世爻所临六亲，不固定）；
//            或 {dai:true, lq:'父母'} 表示代占，主用神=对方六亲。
const CASES = {
  diet:   { domain: { q: '今天中午吃什么好', exp: '妻财' }, override: { q: '我身体不舒服吃啥', exp: '官鬼' } },
  sport:  { domain: { q: '今天适合健身吗', exp: '子孙' }, override: { q: '和朋友打球怎样', exp: '兄弟' } },
  fun:    { domain: { q: '周末去哪玩放松', exp: '子孙' } },
  general:{ domain: { q: '我想做笔投资能赚吗', exp: '妻财' }, neutral: { q: '帮我看看最近运势', exp: { src: '世爻' } } },
  loveM:  { domain: { q: '我和对象能成吗', exp: '妻财', ying: '应爻' }, dai: { q: '我老婆最近对我啥态度', lq: '妻财' } },
  loveF:  { domain: { q: '我男朋友靠谱吗', exp: '官鬼', ying: '应爻' }, dai: { q: '我老公最近怎样', lq: '官鬼' } },
  wealth: { domain: { q: '这笔投资能回本吗', exp: '妻财' }, override: { q: '升职后工资能涨多少', exp: '妻财' } },
  child:  { domain: { q: '能怀孕吗', exp: '子孙' } },
  study:  { domain: { q: '考研能上岸吗', exp: '父母' } },
  career: { domain: { q: '升职能成吗', exp: '官鬼' }, dai: { q: '我领导最近咋样', lq: '官鬼' } },
  job:    { domain: { q: '应聘的职位能拿到offer吗', exp: '官鬼' } },
  news:   { domain: { q: '录取通知书什么时候到', exp: '父母' }, neutral: { q: '有我的消息吗', exp: '父母' } },
  home:   { domain: { q: '家里最近安不安', exp: '父母' } },
  lawsuit:{ domain: { q: '这官司能赢吗', exp: '官鬼', ying: '应爻' } },
  illness:{ domain: { q: '我最近身体不舒服', exp: '官鬼' } },
  travel: { domain: { q: '出门平安吗', exp: { src: '世爻' } }, neutral: { q: '这趟旅行注意什么', exp: { src: '世爻' } } },
  person: { dai: { q: '我爸什么时候回来', lq: '父母' }, dai2: { q: '我儿子啥时候到家', lq: '子孙' } },
  lost:   { domain: { q: '丢的钱包能找回吗', exp: '妻财' } },
  num:    { domain: { q: '这组号码怎么样', exp: { src: '世爻' } } },
  misc:   { domain: { q: '丢了的东西找不到了', exp: '妻财' } },
  fweek:  { domain: { q: '这周财运如何', exp: '妻财' } },
  fyear:  { domain: { q: '今年事业运怎么样', exp: '官鬼' } }
};

// 解析期望
function assertResolve(modId, q, exp, tag) {
  const r = SYM.resolveUseGod(modId, q, CHART);
  const label = modId + '.' + tag;
  ok(label + ' 有结构化输出', r && r.main && typeof r.main.lq === 'string' && Array.isArray(r.aux) && Array.isArray(r.steps));
  if (!exp) return;
  if (typeof exp === 'string') {
    eq(label + ' 用神=' + exp, r.useLq, exp);
  } else if (exp.src === '世爻') {
    eq(label + ' 来源=世爻', r.source, '世爻');
    ok(label + ' 主用神为六亲(非空)', !!r.useLq && LQ.indexOf(r.useLq) >= 0, r.useLq);
  }
}

// 轴锁期望：正确锚句通过、错误用神反置不通过
function assertAxisLock(modId, q, tag) {
  const label = modId + '.' + tag;
  const a = SYM.axisAnchor(CHART, modId, q);
  ok(label + ' 轴锚存在', !!a && typeof a.anchor === 'string' && a.anchor.length > 0, a && a.anchor);
  if (!a) return;
  // 正确文本＝直接引用锚句，verifyAxis 应判一致（注意 checkAxis 第 4 参是 attempt，第 5 参才是 userText）
  const v1 = CFG.checkAxis(modId, CHART, a.anchor, 1, q);
  ok(label + ' 轴锁(正确锚句)通过', v1.ok === true, v1.reason);
  // 错误文本＝用神换成别的六亲，verifyAxis 应判反置硬错
  const wrongLq = (LQ.indexOf(a.useLq) >= 0) ? (LQ[0] === a.useLq ? LQ[1] : LQ[0]) : '官鬼';
  const wrongText = '用神＝' + wrongLq + '（某爻位）；原神＝' + (a.yuan || '妻财') + '；忌神＝' + (a.ji || '兄弟') + '。';
  const v2 = CFG.checkAxis(modId, CHART, wrongText, 1, q);
  ok(label + ' 轴锁(用神反置)判硬错', v2.ok === false, v2.reason);
}

// 完整管线：chartText(内部调 modRoles)/buildStage*/useGodRelation 不崩且关键字段齐
// （modRoles 为 config 内部函数，不导出；此处改以引擎 liuqinYuanJi 校验其依赖的原神/忌神/仇神推导）
function assertPipeline(modId, q, tag) {
  const label = modId + '.' + tag;
  const mod = CFG.MODULES[modId];
  const r = SYM.resolveUseGod(modId, q, CHART);
  const useLq = r.useLq;
  let t, s1, s2, ur;
  try {
    t = CFG.chartText(CHART, mod, q);
    s1 = CFG.buildStage1Messages(modId, q, CHART);
    s2 = CFG.buildStage2Messages(modId, q, CHART, '（总断文本）');
    ur = SYM.useGodRelation(CHART, modId, false, q);
  } catch (e) { fail++; console.error('  ✗ ' + label + ' 管线抛异常 → ' + e.message); return; }
  ok(label + ' 解析用神合法', !!useLq && (useLq === '应爻' || LQ.indexOf(useLq) >= 0), useLq);
  if (useLq !== '应爻') {
    const yj = LY.liuqinYuanJi(PALACE, useLq); // 原神/忌神/仇神随卦宫实算（modRoles 同源）
    ok(label + ' 原/忌/仇随宫实算且为六亲', !!yj && LQ.indexOf(yj.yuan) >= 0 && LQ.indexOf(yj.ji) >= 0 && LQ.indexOf(yj.chou) >= 0, yj && [yj.yuan, yj.ji, yj.chou]);
  }
  ok(label + ' chartText 无 undefined', t.indexOf('undefined') < 0);
  ok(label + ' chartText 含【用神取用】', t.indexOf('【用神取用】') >= 0);
  ok(label + ' chartText 落到解析用神(' + useLq + ')', t.indexOf(useLq) >= 0);
  ok(label + ' useGodRelation 非空', typeof ur === 'string' && ur.length > 0);
  ok(label + ' Stage1 构造可用', Array.isArray(s1) && s1.length >= 2 && typeof s1[1].content === 'string');
  ok(label + ' Stage2 构造可用', Array.isArray(s2) && s2.length >= 2);
}

// ===== 逐模块跑 =====
Object.keys(CASES).forEach(function (modId) {
  const c = CASES[modId];
  console.log('\n===== 模块 ' + modId + '（' + CFG.MODULES[modId].name + '）=====');
  if (c.domain) { assertResolve(modId, c.domain.q, c.domain.exp, 'domain'); assertPipeline(modId, c.domain.q, 'domain'); assertAxisLock(modId, c.domain.q, 'domain');
    if (c.domain.ying) eq(modId + '.domain 应爻轴', SYM.resolveUseGod(modId, c.domain.q, CHART).ying, c.domain.ying); }
  if (c.neutral) { assertResolve(modId, c.neutral.q, c.neutral.exp, 'neutral'); assertPipeline(modId, c.neutral.q, 'neutral'); assertAxisLock(modId, c.neutral.q, 'neutral'); }
  if (c.override) { assertResolve(modId, c.override.q, c.override.exp, 'override'); assertPipeline(modId, c.override.q, 'override'); assertAxisLock(modId, c.override.q, 'override'); }
  ['dai', 'dai2'].forEach(function (k) {
    if (c[k]) {
      const r = SYM.resolveUseGod(modId, c[k].q, CHART);
      eq(modId + '.' + k + ' 代占用神=' + c[k].lq, r.useLq, c[k].lq);
      ok(modId + '.' + k + ' 标记 daiZhan', r.daiZhan === true);
      assertPipeline(modId, c[k].q, k); assertAxisLock(modId, c[k].q, k);
    }
  });
});

// ===== 代占跨模块横扫（确认太极点切换对全部模块生效）=====
console.log('\n===== 代占横扫：全部模块喂代占句，主用神须切到对方六亲 =====');
const DAI_SWEEP = [
  { mod: 'career', q: '我领导最近压力大吗', lq: '官鬼' },
  { mod: 'wealth', q: '我朋友这笔生意能成吗', lq: '兄弟' },
  { mod: 'illness', q: '我妈身体怎么样', lq: '父母' },
  { mod: 'study', q: '我儿子考试能过吗', lq: '子孙' },
  { mod: 'loveM', q: '我老婆最近心情', lq: '妻财' },
  { mod: 'lost', q: '我同事丢的东西找得到吗', lq: '兄弟' },
  { mod: 'home', q: '我爸家里最近安不安', lq: '父母' }
];
let daiFail = 0;
DAI_SWEEP.forEach(function (d) {
  const r = SYM.resolveUseGod(d.mod, d.q, CHART);
  const good = r.daiZhan === true && r.useLq === d.lq;
  if (good) pass++; else { fail++; daiFail++; console.error('  ✗ ' + d.mod + ' 代占 → 期望(' + d.lq + ') 实际(' + r.useLq + ',dai=' + r.daiZhan + ')'); }
});
ok('代占横扫全通过', daiFail === 0, daiFail);

// ===== 多卦 × 全模块 崩溃扫描 =====
console.log('\n===== 多卦(' + 6 + ') × 全' + Object.keys(CASES).length + '模块 管线崩溃扫描 =====');
let crash = 0;
const SIX_PATTERNS = [
  [7, 7, 7, 7, 7, 7], [6, 9, 7, 8, 6, 9], [8, 8, 7, 7, 9, 6],
  [9, 6, 8, 7, 6, 9], [7, 9, 6, 8, 7, 8], [6, 7, 9, 6, 9, 7]
];
SIX_PATTERNS.forEach(function (six, gi) {
  try {
    const ch = LY.arrange({ monthGanZhi: '丙寅', dayGanZhi: '甲子', six: six.map(function (s) { return { sum: s }; }) });
    Object.keys(CASES).forEach(function (modId) {
      const demo = (CASES[modId].domain || CASES[modId].neutral || CASES[modId].dai || { q: '帮我看看' }).q;
      const r = SYM.resolveUseGod(modId, demo, ch);
      if (!r || !r.main || !Array.isArray(r.steps)) crash++;
      const t = CFG.chartText(ch, CFG.MODULES[modId], demo);
      if (t.indexOf('undefined') >= 0) crash++;
      const a = SYM.axisAnchor(ch, modId, demo);
      if (a) { const v = CFG.checkAxis(modId, ch, a.anchor, 1, demo); if (!v.ok) crash++; }
    });
  } catch (e) { crash++; if (crash <= 3) console.error('  CRASH 卦' + gi + ': ' + e.message); }
});
eq('多卦全模块崩溃数=0', crash, 0);

console.log('\n结果：通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
