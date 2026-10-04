/* 专项回归：匹配层兜底 + 置信度分级 + 月建日辰不互论生克
 * 对应本轮三项改动：
 *   ① USEGOD_SYNONYM 近义词兜底层（精确表全不中才启用）
 *   ② resolveUseGod 输出 confidence（high/medium/low），并在 chartText 显示
 *   ③ 月建与日辰不互论生克（用户裁定，依曲炜《六爻答疑》第二十一问）
 */
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');
const CFG = require('../libs/config.js');

const chart = LY.arrange({
  six: [{ sum: 7 }, { sum: 8 }, { sum: 7 }, { sum: 8 }, { sum: 9 }, { sum: 8 }],
  monthGanZhi: '丙寅', dayGanZhi: '甲子'
});

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name + (extra ? '　' + extra : '')); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '　' + extra : '')); }
}

console.log('=== ① 近义词兜底层（精确表全不中才启用）===');
const SYN = [
  ['career', '我最近官运如何', '官鬼'],
  ['study', '学历能不能提升', '父母'],
  ['wealth', '进账多不多', '妻财'],
  ['wealth', '营收怎么样', '妻财'],
  ['child', '什么时候有小孩', '子孙'],
  ['fun', '想找个地方放松一下', null]
];
for (const [mod, q, exp] of SYN) {
  const r = SYM.resolveUseGod(mod, q, chart);
  if (exp === null) continue;
  const viaSyn = r.source === '问句·近义';
  ck(mod + '「' + q + '」→ ' + exp + (viaSyn ? '（近义兜底）' : ''), r.useLq === exp, '实际 ' + r.useLq + '/' + r.source);
}

console.log('\n=== ② 置信度分级 ===');
const CONF = [
  ['career', '升职吗', 'high', '问句'],
  ['career', '官运如何', 'high', '问句'],
  ['study', '学历能不能提升', 'medium', '问句·近义'],
  ['wealth', '进账多不多', 'medium', '问句·近义'],
  ['general', '问这事能不能成', 'low', '世爻'],
  ['travel', '出门远行平安吗', 'high', '世爻'] // 问句明确命中"出行"→世爻为纲属问句明证，故为 high
];
for (const [mod, q, expConf] of CONF) {
  const r = SYM.resolveUseGod(mod, q, chart);
  ck(mod + '「' + q + '」confidence=' + expConf, r.confidence === expConf, '实际 ' + r.confidence);
}
{ // 代占置信度：显式称谓 high，泛指人称 medium
  const a = SYM.resolveUseGod('person', '我爸什么时候回来', chart);
  const b = SYM.resolveUseGod('person', '他最近怎么样', chart);
  ck('代占·显式称谓 confidence=high', a.confidence === 'high', '实际 ' + a.confidence);
  ck('代占·泛指人称 confidence=medium', b.confidence === 'medium', '实际 ' + b.confidence);
}

console.log('\n=== ③ 兜底不得越权：歧义词已剔除 ===');
{ // "考研上岸"中的"上岸"歧义（升学=父母 / 职位=官鬼），必须不参与近义匹配
  const r = SYM.resolveUseGod('study', '考研上岸了吗', chart);
  ck('study「考研上岸了吗」不被"上岸"带偏，仍取父母', r.useLq === '父母', '实际 ' + r.useLq + '/' + r.source);
}
{ // 近义表不得含跨领域单字（"房子"回归）
  const r = SYM.resolveUseGod('home', '这套房子能买吗', chart);
  ck('home「这套房子能买吗」→ 父母（近义层未引入新误命中）', r.useLq === '父母', '实际 ' + r.useLq);
}

console.log('\n=== ④ chartText 显示置信度 ===');
{
  const mod = CFG.MODULES ? CFG.MODULES.study : null;
  const t1 = CFG.chartText(chart, 'study', '学历能不能提升');
  const t2 = CFG.chartText(chart, 'general', '问这事能不能成');
  ck('近义兜底时 chartText 出现置信度提示', /置信度/.test(t1), '');
  ck('低置信时 chartText 出现置信度提示', /置信度/.test(t2), '');
  ck('低置信提示含"勿据此强断"类告诫', /勿据此强断|须结合卦象/.test(t1 + t2), '');
}

console.log('\n=== ⑤ 月建与日辰不互论生克 ===');
{
  let allBG = true, checked = 0;
  const MONTHS = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
  const DAYS = ['甲子', '戊辰', '甲戌', '丙子', '甲申', '庚辰', '甲午', '丁酉', '甲辰', '壬子', '甲寅', '癸酉'];
  for (const mg of MONTHS) for (const dg of DAYS) {
    const c = LY.arrange({ six: [{ sum: 7 }, { sum: 8 }, { sum: 7 }, { sum: 8 }, { sum: 9 }, { sum: 8 }], monthGanZhi: '丙' + mg, dayGanZhi: dg });
    (c.riyue.notes || []).forEach((n) => {
      // 只筛"月建与日辰之间关系"的条目；"月合+日冲（作用于卦爻）"等属日辰对卦爻，不在此列
      if (!/月日|月建生日辰|月建克日辰/.test(n)) return;
      checked++;
      if (!/气候背景/.test(n)) allBG = false;
    });
  }
  ck('月日互论条目全部标注为气候背景（抽查 ' + checked + ' 条）', allBG && checked > 0, '未标注=' + (allBG ? 0 : '有'));
}
{ // 反向断言：月日互论条目不得出现"极旺/极衰"等判定性措辞
  const c = LY.arrange({ six: [{ sum: 7 }, { sum: 8 }, { sum: 7 }, { sum: 8 }, { sum: 9 }, { sum: 8 }], monthGanZhi: '丙寅', dayGanZhi: '甲寅' });
  const bad = (c.riyue.notes || []).filter((n) => /月日|月建生|月建克/.test(n) && /极旺|极衰/.test(n) && !/不据以定旺衰/.test(n));
  ck('月日条目不含"极旺/极衰"等判定性措辞', bad.length === 0, '违例 ' + bad.length + ' 条');
}
{ // 月破得日辰救应必须保留（日辰对卦爻，非月日互论）
  let rescueOK = 0, rescueTotal = 0;
  const MONTHS = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
  const DAYS = ['甲子', '戊辰', '甲戌', '丙子', '甲申', '庚辰', '甲午', '丁酉', '甲辰', '壬子', '甲寅', '癸酉'];
  for (const mg of MONTHS) for (const dg of DAYS) {
    const c = LY.arrange({ six: [{ sum: 7 }, { sum: 8 }, { sum: 7 }, { sum: 8 }, { sum: 9 }, { sum: 8 }], monthGanZhi: '丙' + mg, dayGanZhi: dg });
    Object.keys(c.riyue.rescue || {}).forEach((k) => { rescueTotal++; if (c.riyue.rescue[k].delta > 0) rescueOK++; });
  }
  ck('月破得日辰生合救应仍生效（日辰作用于卦爻不受影响），命中 ' + rescueTotal + ' 例', rescueTotal > 0 && rescueOK > 0);
}

console.log('\n结果：通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail === 0 ? 0 : 1);
