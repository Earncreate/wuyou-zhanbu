/* 消融实验（A/B 对照）：验证《卜筮正宗》两条关系规则（避空 / 贪生忘克）注入后是否真的改善 AI 总断
 *
 * 设计要点（吸取历史教训）：
 *   ① 必须是**真开关**——历史上做轴锁消融时，对照组同样吃到了契约文本，两组都 100% 无差异，
 *      教训是"没做真消融就不要报消融结论"。此处用 LY.setAblation({relationRules:false}) 真实关闭规则。
 *   ② A9（真空哨兵值归零）是纯 bug 修复，**不参与消融**，两组都生效。
 *   ③ 无 WY_KEY 时自动降级为干跑：验证开关真实性 + 产出实验素材 JSON，不发任何请求。
 *
 * 运行：
 *   干跑：node tmp/test_ablation_rules.js
 *   真跑：WY_BASE=https://api.deepseek.com/v1 WY_MODEL=deepseek-chat WY_KEY=sk-xxx node tmp/test_ablation_rules.js
 */
const fs = require('fs');
const path = require('path');
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');
const CFG = require('../libs/config.js');

const WY_BASE = process.env.WY_BASE || '';
const WY_MODEL = process.env.WY_MODEL || '';
const WY_KEY = process.env.WY_KEY || '';
const LIVE = !!WY_KEY;

const MONTHS = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
const DAYS = ['甲子', '戊辰', '甲戌', '丙子', '甲申', '庚辰', '甲午', '丁酉', '甲辰', '壬子', '甲寅', '癸酉'];
const LIUQIN = ['兄弟', '子孙', '妻财', '父母', '官鬼'];
const QUIZ = { loveM: '这段感情能成吗', loveF: '他什么时候会出现', wealth: '这笔生意能赚吗', career: '今年能升职吗',
  illness: '我这个病严重吗', study: '这次考试能过吗', child: '什么时候能怀上孩子', lost: '丢的东西能找回来吗', job: '这个offer能拿到吗' };

// 场景筛选：找真实卦例中命中「避空」或「贪生忘克」的用神组合
// 注意：两类场景须**均衡收集**——贪生忘克（忌神动+原神动）条件更易满足，会先填满名额，
// 导致素材全是贪生忘克、避空缺席，实验结论会偏向单侧规则。
function collectScenes() {
  const byKind = { '避空': [], '贪生忘克': [] };
  const PER_KIND = 12;
  const PER_GUA = 2;   // 每个卦最多贡献 2 个场景——否则同一卦的不同月日会填满名额，素材无代表性
  const perGua = {};
  for (let id = 0; id < 64; id++) {
    if (byKind['避空'].length >= PER_KIND && byKind['贪生忘克'].length >= PER_KIND) break;
    const up = Math.floor(id / 8), lo = id % 8;
    const y = [lo & 1, (lo >> 1) & 1, (lo >> 2) & 1, up & 1, (up >> 1) & 1, (up >> 2) & 1];
    const variants = [y.map((v, i) => (i === 2 || i === 4 ? (v ? 9 : 6) : (v ? 7 : 8))),
                      y.map((v, i) => (i === 1 || i === 5 ? (v ? 9 : 6) : (v ? 7 : 8)))];
    for (const six of variants) for (const mg of MONTHS) for (const dg of DAYS) {
      if (byKind['避空'].length >= PER_KIND && byKind['贪生忘克'].length >= PER_KIND) break;
      let c;
      try { c = LY.arrange({ six: six.map((s) => ({ sum: s })), monthGanZhi: '丙' + mg, dayGanZhi: dg }); } catch (e) { continue; }
      for (const lq of LIUQIN) {
        const modId = Object.keys(QUIZ).find((m) => (SYM.resolveUseGod(m, QUIZ[m], c) || {}).useLq === lq);
        if (!modId) continue;
        LY.setAblation({ relationRules: true });
        const on = LY.getUseGodRelation(c, lq);
        if (!on || !on.verdict) continue;
        const hit = on.verdict.find((v) => /避空|贪生忘克/.test(v));
        if (!hit) continue;
        const kind = /避空/.test(hit) ? '避空' : '贪生忘克';
        if (byKind[kind].length >= PER_KIND) continue;
        const guaName = c.ben.name;
        perGua[guaName] = perGua[guaName] || 0;
        if (perGua[guaName] >= PER_GUA) continue;   // 控制单卦占比，保证卦象多样性
        perGua[guaName]++;
        byKind[kind].push({ chart: c, lq: lq, modId: modId, kind: kind, hit: hit, sixRaw: six.slice() });
      }
    }
  }
  return byKind['避空'].concat(byKind['贪生忘克']);
}

function render(c, lq, on) {
  LY.setAblation({ relationRules: on });
  const r = LY.getUseGodRelation(c, lq);
  const v = (r.verdict || []).join('；');
  const m = v.match(/阵营净力[^＝]*＝\s*(-?\d+)/);
  return { text: v, net: m ? parseInt(m[1], 10) : null };
}

const scenes = collectScenes();
console.log('命中「避空/贪生忘克」的真实卦例场景：' + scenes.length + ' 个');
console.log('　避空 ' + scenes.filter((s) => s.kind === '避空').length + ' 个 / 贪生忘克 ' + scenes.filter((s) => s.kind === '贪生忘克').length + ' 个\n');

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name + (extra ? '　' + extra : '')); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '　' + extra : '')); }
}

console.log('=== ① 消融开关真实性（历史教训：对照组必须真的不同）===');
{
  let realDiff = 0;
  for (const s of scenes) {
    const on = render(s.chart, s.lq, true);
    const off = render(s.chart, s.lq, false);
    if (on.text !== off.text) realDiff++;
  }
  ck('对照组与实验组输出确有差异：' + realDiff + '/' + scenes.length, realDiff === scenes.length);
  const s0 = scenes[0];
  if (s0) {
    const on = render(s0.chart, s0.lq, true), off = render(s0.chart, s0.lq, false);
    ck('实验组含关系条款', /避空|贪生忘克/.test(on.text), s0.kind);
    ck('对照组不含关系条款', !/避空|贪生忘克/.test(off.text), '');
    ck('两组净力不同（忌神是否计入）', on.net !== off.net, '实验组 ' + on.net + ' / 对照组 ' + off.net);
  }
}

console.log('\n=== ② 场景样例（实验组 vs 对照组）===');
scenes.slice(0, 5).forEach((s) => {
  const on = render(s.chart, s.lq, true), off = render(s.chart, s.lq, false);
  console.log('  【' + s.kind + '】' + s.chart.ben.name + ' / 用神' + s.lq + '（' + s.modId + '）');
  console.log('    实验组 net=' + on.net + '　' + (on.text.match(/避空|贪生忘克[^；]*/) || [''])[0]);
  console.log('    对照组 net=' + off.net + '　' + (off.text.match(/阵营净力[^；]*/) || [''])[0]);
});

console.log('\n=== ③ 净力方向统计（规则是否真的改变了吉凶方向）===');
{
  let flip = 0;
  scenes.forEach((s) => {
    const on = render(s.chart, s.lq, true), off = render(s.chart, s.lq, false);
    const dOn = on.net > 0 ? 1 : (on.net < 0 ? -1 : 0);
    const dOff = off.net > 0 ? 1 : (off.net < 0 ? -1 : 0);
    if (dOn !== dOff) flip++;
  });
  ck('规则使净力方向改变的场景：' + flip + '/' + scenes.length + '（' + (scenes.length ? Math.round(flip / scenes.length * 100) : 0) + '%）', true);
  console.log('    说明：方向改变越多＝规则影响越大；仅净力数值微变而方向不改者，对吉凶结论无实质影响。');
}

// 产出实验素材，供 LLM 环节使用
const payload = scenes.map((s) => {
  const on = render(s.chart, s.lq, true), off = render(s.chart, s.lq, false);
  return {
    gua: s.chart.ben.name, month: s.chart.monthZhi, day: s.chart.dayZhi,
    sixRaw: s.sixRaw,   // 供真跑环节重建同一卦（arrange 需原始 sum 序列）
    useLq: s.lq, mod: s.modId, ask: QUIZ[s.modId], kind: s.kind, ruleHit: s.hit,
    onNet: on.net, offNet: off.net, onVerdict: on.text, offVerdict: off.text,
    six: s.chart.ben.yaos.map((y) => ({ pos: y.posName, gz: y.ganzhi, lq: y.liuqin, wx: y.wuxing,
      mov: !!y.isMoving, shi: !!y.isShi, kong: !!y.isKong, yuepo: !!y.isYuePo, score: y.wang ? y.wang.score : null, level: y.wang ? y.wang.level : null }))
  };
});
const outFile = path.join(__dirname, 'ablation_rules_payload.json');
fs.writeFileSync(outFile, JSON.stringify(payload, null, 1), 'utf8');
console.log('\n实验素材已落：' + outFile + '（' + payload.length + ' 场景）');

LY.setAblation({ relationRules: true }); // 复位为生产行为

if (!LIVE) {
  console.log('\n[未配置 WY_KEY] 本次为干跑：已验证消融开关真实有效并产出实验素材，未发出任何请求。');
  console.log('真跑命令：WY_BASE=https://api.deepseek.com/v1 WY_MODEL=deepseek-chat WY_KEY=sk-xxx node tmp/test_ablation_rules.js');
} else {
  console.log('\n[已配置 WY_KEY] 真跑环节（L1/L2 生成 + 评审打分）待接入。');
}

console.log('\n结果：通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail === 0 ? 0 : 1);
