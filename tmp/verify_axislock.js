/* 轴锁引擎级校验（不烧 key）
 * 验证三件事：
 *  1) axisAnchor 为每个有固定用神的模块产出唯一真值锚句（常量）
 *  2) verifyAxis 能抓住已知的 H2 反置文本（模型曾写"用神＝子孙、忌神＝官鬼"）
 *  3) verifyAxis 对正确文本放行；domainGate 对中性/错配问句给出提示
 */
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');
const CFG = require('../libs/config.js');

const CASES = [
  { key: 'H1既济→loveM', six: [{ sum: 9 }, { sum: 8 }, { sum: 7 }, { sum: 6 }, { sum: 7 }, { sum: 8 }], mod: 'loveM' },
  { key: 'H2困→illness', six: [{ sum: 6 }, { sum: 7 }, { sum: 8 }, { sum: 9 }, { sum: 7 }, { sum: 8 }], mod: 'illness' },
  { key: 'H3蛊→career', six: [{ sum: 8 }, { sum: 9 }, { sum: 7 }, { sum: 6 }, { sum: 8 }, { sum: 7 }], mod: 'career' },
  { key: 'H4随→wealth', six: [{ sum: 9 }, { sum: 6 }, { sum: 8 }, { sum: 7 }, { sum: 9 }, { sum: 6 }], mod: 'wealth' },
  { key: 'H5履→study', six: [{ sum: 7 }, { sum: 8 }, { sum: 7 }, { sum: 8 }, { sum: 9 }, { sum: 8 }], mod: 'study' },
  { key: 'H6否→lost', six: [{ sum: 9 }, { sum: 6 }, { sum: 6 }, { sum: 9 }, { sum: 6 }, { sum: 9 }], mod: 'lost' },
  { key: 'H7比→job', six: [{ sum: 8 }, { sum: 8 }, { sum: 7 }, { sum: 6 }, { sum: 7 }, { sum: 8 }], mod: 'job' },
  { key: 'general(无固定用神)', six: [{ sum: 9 }, { sum: 8 }, { sum: 7 }, { sum: 6 }, { sum: 7 }, { sum: 8 }], mod: 'general' }
];

const MG = '丙寅', DG = '甲子';
let fail = 0;

console.log('=== 1) axisAnchor 锚句产出 ===');
const charts = {};
CASES.forEach(c => {
  const chart = LY.arrange({ six: c.six, monthGanZhi: MG, dayGanZhi: DG });
  charts[c.mod] = chart;
  const a = SYM.axisAnchor(chart, c.mod);
  if (!a) { console.log('  ' + c.key + ' → 无锚句（通用模块，符合设计）'); return; }
  console.log('  ' + c.key + ' → ' + a.anchor);
});

console.log('\n=== 2) verifyAxis 抓错能力 ===');
// 2a. 已知真实反置文本（H2 疾病，模型曾把子孙当用神、官鬼当忌神）
const h2 = charts['illness'];
const badText = '用神＝四爻丁亥子孙（医药/恢复力），忌神＝三爻戊午官鬼（病症），此为唯一用神轴心，不以子孙代替病体。';
const rBad = SYM.verifyAxis(h2, 'illness', badText);
console.log('  [真实反置文本] ok=' + rBad.ok + '  reason=' + rBad.reason);
if (rBad.ok) { console.log('  !! 漏抓，轴锁无效'); fail++; } else console.log('  ✓ 正确判为轴反置');

// 2a2. 用神正确但原神/忌神互换（study 父母用神：原神恒为官鬼、忌神恒为妻财；写反即错）
const badText2 = '用神＝父母（四爻），原神＝妻财，忌神＝官鬼。';
const rBad2 = SYM.verifyAxis(charts['study'], 'study', badText2);
console.log('  [原神反置文本] ok=' + rBad2.ok + '  reason=' + rBad2.reason);
if (rBad2.ok) { console.log('  !! 漏抓原神反置'); fail++; } else console.log('  ✓ 正确判为原神反置');

// 2b. 正确文本应放行（动态取锚句 + 动态拼后续说明，避免手写期望值随生克表修正而失效）
const axH2 = SYM.axisAnchor(h2, 'illness');
const goodText = axH2.anchor + '\n原神' + axH2.yuan + '生用神，忌神' + axH2.ji + '克用神。';
const rGood = SYM.verifyAxis(h2, 'illness', goodText);
console.log('  [正确回抄]  ok=' + rGood.ok + '  reason=' + rGood.reason);
if (!rGood.ok) { console.log('  !! 误杀，轴锁过严'); fail++; } else console.log('  ✓ 正确放行');

// 2b2. 用旧数据写的期望（写死旧表"官鬼用神原神＝父母、忌神＝妻财"）应判失败——证明校验器用的是逐卦实算的新引擎
const staleText = '用神＝官鬼（三爻）；原神＝父母；忌神＝妻财。';
const rStale = SYM.verifyAxis(h2, 'illness', staleText);
console.log('  [旧生克数据] ok=' + rStale.ok + '  reason=' + rStale.reason);
if (rStale.ok) { console.log('  !! 校验器仍在用旧表，须检查 YUAN_JI 来源'); fail++; } else console.log('  ✓ 正确识别为旧表数据');

// 2c. 未声明轴 → 应判失败
const rNone = SYM.verifyAxis(h2, 'illness', '此事吉凶如何，应在三日。');
console.log('  [完全无轴声明] ok=' + rNone.ok + '  reason=' + rNone.reason);
if (rNone.ok) { console.log('  !! 未抓到缺轴'); fail++; } else console.log('  ✓ 正确判为缺轴');

// 2d. 通用模块不校验（保持基线对照）
const rGen = SYM.verifyAxis(charts['general'], 'general', '随便说点什么，用神是兄弟。');
console.log('  [通用模块]   ok=' + rGen.ok + '  reason=' + rGen.reason);

// 2e. 全部模块扫一遍：把正确锚句喂回去，必须全部放行（防过严）
console.log('\n=== 3) 全模块锚句自洽（喂回自身锚句必须放行）===');
CASES.forEach(c => {
  const a = SYM.axisAnchor(charts[c.mod], c.mod);
  if (!a) return;
  const r = SYM.verifyAxis(charts[c.mod], c.mod, a.anchor);
  if (!r.ok) { console.log('  !! ' + c.key + ' 自校验失败：' + r.reason); fail++; }
  else console.log('  ✓ ' + c.key);
});

console.log('\n=== 4) 轴锁指令是否进入提示词 ===');
['illness', 'loveM', 'career'].forEach(m => {
  const s1 = SYM.stage1Anchor(charts[m], m);
  const s2 = SYM.selectSymbols(charts[m], m);
  const has1 = s1.indexOf('系统已判定常量') >= 0;
  const has2 = s2.indexOf('输出契约') >= 0;
  console.log('  ' + m + '  Stage1含轴锁=' + has1 + '  Stage2含回抄契约=' + has2);
  if (!has1 || !has2) fail++;
});
const genS2 = SYM.selectSymbols(charts['general'], 'general');
console.log('  general 不注入轴锁=' + (genS2.indexOf('用神轴·系统已判定常量') < 0));

console.log('\n=== 5) 领域错配闸门 ===');
const NEUTRAL = '我心里一直有个事放不下，想问问这件事到底怎么样，是成是败、是吉是凶？';
const g1 = CFG.domainNotice('illness', NEUTRAL);
console.log('  中性问句 + illness → neutral=' + g1.neutral);
console.log('    note: ' + g1.note.slice(0, 60) + '…');
const g2 = CFG.domainNotice('illness', '我最近老咳嗽，半夜咳得睡不着，要不要去医院？');
console.log('  明确疾病问句 + illness → neutral=' + g2.neutral + '（期望 false）');
if (g2.neutral) fail++;
const g3 = CFG.domainNotice('general', NEUTRAL);
console.log('  中性问句 + general → neutral=' + g3.neutral + '（期望 false，通用模块不设闸）');
if (g3.neutral) fail++;

console.log('\n=== 结果 ===');
console.log(fail === 0 ? '全部通过，0 失败' : ('失败项：' + fail));
process.exit(fail === 0 ? 0 : 1);
