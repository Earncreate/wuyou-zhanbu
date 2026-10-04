/* 消融实验 · 真跑环节（烧 DeepSeek key）
 *
 * 目的：回答一个具体问题——引擎新加的《卜筮正宗》两条关系规则（避空 / 贪生忘克），
 *      投喂给模型后，AI 总断是否真的变得更准、是否真的采信了这些条款。
 *
 * 读入 tmp/ablation_rules_payload.json（由 test_ablation_rules.js 干跑产出），对每个场景：
 *   实验组：relationRules=true  （含避空/贪生忘克条款）
 *   对照组：relationRules=false （回退纯分数对比，与生产改动前等价）
 *   每组各生成一次 Stage2 模块深化断语，再由评审按统一量表打分并判胜者。
 *
 * 关键约束（历史教训）：
 *   - 开关在 buildStage2Messages 之前设定，因 chartText 为实时计算，会即时读取 ABLATION。
 *   - 温度固定 0.7，与生产一致（用户明令不得降温度）。
 *   - A9 真空归零两组都生效，不参与消融（它是 bug 修复，非可消融规则）。
 *
 * 运行：
 *   WY_BASE=https://api.deepseek.com/v1 WY_MODEL=deepseek-chat WY_KEY=sk-xxx node tmp/run_ablation_llm.js [场景上限]
 */
const fs = require('fs');
const path = require('path');
const LY = require('../libs/liuyao.js');
const CFG = require('../libs/config.js');

const WY_BASE = process.env.WY_BASE || 'https://api.deepseek.com/v1';
const WY_MODEL = process.env.WY_MODEL || 'deepseek-chat';
const WY_KEY = process.env.WY_KEY || '';
const LIMIT = parseInt(process.argv[2] || '0', 10); // 0 = 全量

if (!WY_KEY) { console.error('未配置 WY_KEY。'); process.exit(1); }

const payload = JSON.parse(fs.readFileSync(path.join(__dirname, 'ablation_rules_payload.json'), 'utf8'));
const scenes = LIMIT > 0 ? payload.slice(0, LIMIT) : payload;
console.log('待跑场景 ' + scenes.length + ' 个（每场景 2 次生成 + 1 次评审）\n预计请求数 ' + scenes.length * 3 + '\n');

async function callLLM(messages) {
  const url = WY_BASE.replace(/\/$/, '') + '/chat/completions';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + WY_KEY },
    body: JSON.stringify({ model: WY_MODEL, messages: messages, temperature: 0.7, stream: false })
  });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return j.choices[0].message.content;
}

function rebuild(s) {
  return LY.arrange({
    six: s.sixRaw.map((x) => ({ sum: x })),
    monthGanZhi: '丙' + s.month, dayGanZhi: s.day
  });
}

const SYS_REVIEW = [
  '你是六爻断语的严格评审，六爻理论依据以《卜筮正宗》《增删卜易》为准。',
  '你会看到同一卦的两段断语：实验组（系统已给出关系条款）与对照组（无条款，仅纯分数对比）。',
  '两段都必须与【系统实况】一致；不要因为实验组更长就偏好它。',
  '评分总则：一致性优先于表达，表达优先于长度。'
].join('');

function buildReviewPrompt(s, onOut, offOut) {
  return [
    '【卦象】' + s.gua + '　月建' + s.month + '　日辰' + s.day,
    '【所问】' + s.ask,
    '【用神】' + s.useLq + '（' + s.kind + '场景）',
    '',
    '**评分前必读**：每一组只与**本组自己的系统实况**比对——',
    '　· 实验组断语　只与【系统实况·实验组】比对；',
    '　· 对照组断语　只与【系统实况·对照组】比对；',
    '　· 采信本组实况**不算**"擅自改判"。两套实况本就不同（实验组计入避空/贪生忘克条款），不可混用、不可互相印证。',
    '　· 断语中若自行重算净力，其结果与本组实况一致者不扣分、不一致者按一致性扣分。',
    '',
    '【系统实况·实验组（此组唯一真值）】' + s.onVerdict,
    '【系统实况·对照组（此组唯一真值）】' + s.offVerdict,
    '',
    '【实验组断语】', onOut,
    '', '【对照组断语】', offOut, '',
    '请分别给两段打分（每项 0/1/2，总分 0-6）：',
    '1. 一致性：与**本组**系统实况的用神、旺衰、力量方向是否一致（本组阵营净力>0 偏吉，<0 偏凶，=0 两可），有无擅自改判或自行重算出不同结果。',
    '2. 依据充分：是否明确引用本组系统给出的旺衰分数、生克关系或相关条款作为断语依据，而非空泛而谈。',
    '3. 取象展开：是否在本组系统事实基础上作了合理取象，结构清晰，无幻觉、无重复罗列。',
    '只输出如下 JSON，不要任何额外文字：',
    '{"on":{"cons":n,"basis":n,"xiang":n,"total":n},"off":{"cons":n,"basis":n,"xiang":n,"total":n},"winner":"on|off|tie","note":"一句话理由"}'
  ].join('\n');
}

function parseJudge(txt) {
  if (!txt) return null;
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}

const results = [];
let done = 0;

async function runOne(s) {
  const chart = rebuild(s);
  // 实验组：规则开
  LY.setAblation({ relationRules: true });
  const onMsg = CFG.buildStage2Messages(s.mod, s.ask, chart, '（总断文本，本实验仅测模块深化）');
  const onOut = await callLLM(onMsg);
  // 对照组：规则关
  LY.setAblation({ relationRules: false });
  const offMsg = CFG.buildStage2Messages(s.mod, s.ask, chart, '（总断文本，本实验仅测模块深化）');
  const offOut = await callLLM(offMsg);
  LY.setAblation({ relationRules: true });

  const judgeTxt = await callLLM([{ role: 'system', content: SYS_REVIEW },
    { role: 'user', content: buildReviewPrompt(s, onOut, offOut) }]);
  const j = parseJudge(judgeTxt);

  done++;
  const rec = {
    gua: s.gua, month: s.month, day: s.day, useLq: s.useLq, mod: s.mod, kind: s.kind,
    onNet: s.onNet, offNet: s.offNet,
    onLen: onOut.length, offLen: offOut.length,
    onOut, offOut, judgeRaw: judgeTxt, judge: j
  };
  results.push(rec);
  console.log('[' + done + '/' + scenes.length + '] ' + s.gua + ' ' + s.month + s.day + ' 用神' + s.useLq
    + ' (' + s.kind + ')　实验组' + (j ? j.on.total : '?') + ' / 对照组' + (j ? j.off.total : '?')
    + '　胜者' + (j ? j.winner : '?'));
  fs.writeFileSync(path.join(__dirname, 'ablation_llm_results.json'), JSON.stringify(results, null, 1), 'utf8');
}

(async function () {
  const CONC = 3;
  for (let i = 0; i < scenes.length; i += CONC) {
    const batch = scenes.slice(i, i + CONC);
    try { await Promise.all(batch.map(runOne)); }
    catch (e) { console.error('批次失败（' + i + '起）：', e.message); }
    await new Promise((r) => setTimeout(r, 400)); // 轻微限速
  }

  const scored = results.filter((r) => r.judge);
  if (!scored.length) { console.log('\n无有效评审结果。'); return; }
  const sum = (k) => scored.reduce((a, r) => a + r.judge[k].total, 0);
  const cnt = scored.length;
  const winOn = scored.filter((r) => r.judge.winner === 'on').length;
  const winOff = scored.filter((r) => r.judge.winner === 'off').length;
  const tie = scored.filter((r) => r.judge.winner === 'tie').length;

  console.log('\n================ 消融结果 ================');
  console.log('有效评审 ' + cnt + ' 例');
  console.log('实验组均分 ' + (sum('on') / cnt).toFixed(2) + '　对照组均分 ' + (sum('off') / cnt).toFixed(2));
  console.log('胜者：实验组 ' + winOn + ' / 对照组 ' + winOff + ' / 平 ' + tie);
  console.log('平均输出长度：实验组 ' + Math.round(scored.reduce((a, r) => a + r.onLen, 0) / cnt)
    + ' 字，对照组 ' + Math.round(scored.reduce((a, r) => a + r.offLen, 0) / cnt) + ' 字');
  const byKind = {};
  scored.forEach((r) => {
    byKind[r.kind] = byKind[r.kind] || { n: 0, on: 0, off: 0, w: 0 };
    byKind[r.kind].n++; byKind[r.kind].on += r.judge.on.total; byKind[r.kind].off += r.judge.off.total;
    if (r.judge.winner === 'on') byKind[r.kind].w++;
  });
  Object.keys(byKind).forEach((k) => {
    const b = byKind[k];
    console.log('　' + k + '：实验组 ' + (b.on / b.n).toFixed(2) + ' vs 对照组 ' + (b.off / b.n).toFixed(2)
      + '，实验组胜 ' + b.w + '/' + b.n);
  });
  console.log('\n（实验组含避空/贪生忘克条款，对照组无。分数含"依据充分"项，故实验组该项天然占优——'
    + '这正是要验证的点：模型是否真的把引擎事实用进了断语。）');
})();
