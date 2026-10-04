/* 数字下沉消融 · 真跑（烧 DeepSeek key）
 *
 * 检验命题：结构规则（爻层次／变爻旁爻）下沉为**数字生成规则**之后，模型是否真的绕不开。
 *
 * 三组设计（2×2 缺一格，据实说明）：
 *   ON   数字已过滤 + 有说明文字（＝当前生产行为）
 *   BARE 数字已过滤 + 无说明文字（＝只给数字，把推理权全交模型）
 *   OFF  数字未过滤 + 无说明文字（＝"不下沉"的反事实：给原始旺衰分）
 *
 *   ON  vs BARE → 隔离「说明文字」
 *   BARE vs OFF → 隔离「数字是否过滤」← 主命题
 *
 * 硬指标（不依赖评审模型的主观打分，用字符串匹配客观判定）：
 *   citeSelf   断语中是否复述了**本组**给出的关键数字（用神分/忌神分/净力绝对值）
 *   dirMatch   断语吉凶方向是否与**本组**净力方向一致（这是"绕开"最直接的暴露口：
 *              OFF 组数字若与 ON 组相反而模型仍给出 ON 组的吉凶方向，即为采信了别的数字）
 *
 * 历史教训（务必保留）：
 *   ① 必须真开关：三组提示词逐字节数差须 > 0，脚本自检。
 *   ② 评审须按**本组自己的实况**比对，两套实况不可混用、不可互相印证。
 *   ③ 温度固定 0.7（用户明令不得降温度当创可贴）。
 *
 * 运行：
 *   WY_BASE=https://api.deepseek.com/v1 WY_MODEL=deepseek-chat WY_KEY=sk-xxx node tmp/run_digit_ablation.js
 */
const fs = require('fs');
const path = require('path');
const LY = require('../libs/liuyao.js');
const CFG = require('../libs/config.js');

const WY_BASE = process.env.WY_BASE || 'https://api.deepseek.com/v1';
const WY_MODEL = process.env.WY_MODEL || 'deepseek-chat';
const WY_KEY = process.env.WY_KEY || '';
const LIMIT = parseInt(process.argv[2] || '0', 10);

if (!WY_KEY) { console.error('未配置 WY_KEY。'); process.exit(1); }

const payload = JSON.parse(fs.readFileSync(path.join(__dirname, 'digit_ablation_payload.json'), 'utf8'));
const scenes = LIMIT > 0 ? payload.slice(0, LIMIT) : payload;
const OUT = path.join(__dirname, 'digit_ablation_results.json');

const GROUPS = {
  on:   { yaoLayer: true,  layerWords: true,  label: 'ON  过滤数字+说明文字' },
  bare: { yaoLayer: true,  layerWords: false, label: 'BARE 过滤数字，无说明' },
  off:  { yaoLayer: false, layerWords: false, label: 'OFF 未过滤数字，无说明' }
};

async function callLLM(messages, tag) {
  const url = WY_BASE.replace(/\/$/, '') + '/chat/completions';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + WY_KEY },
        body: JSON.stringify({ model: WY_MODEL, messages, temperature: 0.7, stream: false })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      return j.choices[0].message.content;
    } catch (e) {
      if (attempt === 3) { console.error('[' + tag + '] 请求失败：' + e.message); return ''; }
      await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
  }
  return '';
}

function rebuild(s) {
  return LY.arrange({ six: s.sixRaw.map((x) => ({ sum: x })), monthGanZhi: '丙' + s.month, dayGanZhi: s.day });
}

// 关键：Ablation 是**模块级全局变量**，本脚本三场景并发（Promise.all），
// 若在 await 之后再读引擎数字，会读到别的场景刚设好的开关 → 数字串组。
// 故必须把「设开关 → 建提示词 → 读本组数字」全部放在同一个同步块内完成，
// await 只发生在拿到消息之后。曾经的 bug：组内数字 8/12 串组，方向指标全部失真。
function buildMsgs(s, gk) {
  LY.setAblation({ relationRules: true, yaoLayer: GROUPS[gk].yaoLayer, layerWords: GROUPS[gk].layerWords });
  const chart = rebuild(s);
  const msgs = CFG.buildStage2Messages(s.mod, s.ask, chart, '（总断文本，本实验仅测模块深化）');
  const rel = LY.getUseGodRelation(chart, s.useLq) || {};
  const netTxt = (rel.verdict || []).join('；').match(/阵营净力[^＝]*＝\s*(-?\d+)/);
  const info = { ys: rel.ysScore, js: rel.jsEff, yuan: rel.yuanEff, chou: rel.chouEff,
    net: netTxt ? parseInt(netTxt[1], 10) : null };
  return { msgs, text: msgs.map((m) => m.content).join('\n'), chart, info };
}

// ---- 硬指标：不依赖评审模型，直接在断语文本上客观判定 ----
function hasNum(txt, n) {
  if (n === null || n === undefined) return false;
  // 用神分可能为负；净力一律取绝对值比较（断语通常说"净力为负/-3"或"净力 8"）
  const pat = n < 0 ? String(n) : String(Math.abs(n));
  return txt.indexOf(pat) >= 0;
}
function hardMetrics(out, info) {
  const t = out || '';
  return {
    citeYs: hasNum(t, info.ys),
    citeJi: hasNum(t, info.js),
    citeNet: hasNum(t, info.net)
  };
}
// 方向判定：断语里吉凶倾向词频（粗但客观；再由评审复核）
const GOOD = ['吉', '成', '通', '顺', '有利', '可行', '稳', '愈', '胜'];
const BAD = ['凶', '败', '阻', '不成', '不利', '难', '危', '损'];
function dirOfText(t) {
  let g = 0, b = 0;
  GOOD.forEach((w) => { g += (t.split(w).length - 1); });
  BAD.forEach((w) => { b += (t.split(w).length - 1); });
  if (g === b) return 0;
  return g > b ? 1 : -1;
}

const SYS_REVIEW = [
  '你是六爻断语的严格评审，理论依据以《卜筮正宗》《增删卜易》《六爻详真》为准。',
  '你会看到同一卦的三段断语，分别对应三套不同的系统实况。',
  '每段断语**只与它自己那一组的系统实况**比对，三套实况不可混用、不可互相印证。',
  '采信本组实况不算"擅自改判"；但若断语自行重算出与本组不同的净力或方向，须扣一致性分。',
  '评分总则：一致性优先于依据，依据优先于表达，表达优先于长度。不要因某组更长而偏好它。'
].join('');

function buildReviewPrompt(s, outs, infos) {
  const P = [];
  P.push('【卦象】' + s.gua + '　月建' + s.month + '　日辰' + s.day);
  P.push('【所问】' + s.ask + '（' + s.mod + ' 模块）');
  P.push('【用神】' + s.useLq);
  P.push('');
  P.push('**评分前必读**：每组只与**本组自己的系统实况**比对——');
  Object.keys(GROUPS).forEach((g) => {
    P.push('　· ' + GROUPS[g].label + '　→　只与【系统实况·' + g.toUpperCase() + '】比对。');
  });
  P.push('　· 三套实况本就不同（数字过滤与不过滤之别），不可混用。');
  P.push('');
  Object.keys(GROUPS).forEach((g) => {
    P.push('【系统实况·' + g.toUpperCase() + '】用神' + infos[g].ys + '，忌神' + infos[g].js
      + '，原神' + infos[g].yuan + '，仇神' + infos[g].chou + '；阵营净力 ' + infos[g].net
      + '（' + (infos[g].net > 0 ? '吉象' : infos[g].net < 0 ? '凶象' : '两可') + '）。');
  });
  P.push('');
  Object.keys(GROUPS).forEach((g) => {
    P.push('【' + GROUPS[g].label + '】', outs[g] || '（空）', '');
  });
  P.push('请给三段各打分（每项 0/1/2，总分 0-6）：');
  P.push('1. 一致性：与**本组**实况的用神、旺衰、力量方向是否一致（净力>0 偏吉，<0 偏凶，=0 两可），有无擅自改判或自行重算出不同结果。');
  P.push('2. 依据充分：是否明确引用本组实况给出的分数或生克关系作为断语依据，而非空泛而谈。');
  P.push('3. 取象展开：是否在本组事实基础上作合理取象，结构清晰，无幻觉、无重复罗列。');
  P.push('只输出如下 JSON，不要任何额外文字：');
  P.push('{"on":{"cons":n,"basis":n,"xiang":n,"total":n},"bare":{"cons":n,"basis":n,"xiang":n,"total":n},'
    + '"off":{"cons":n,"basis":n,"xiang":n,"total":n},"best":"on|bare|off","note":"一句话理由"}');
  return P.join('\n');
}

function parseJudge(txt) {
  const m = (txt || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}

// ---- 真开关自检：三组提示词必须逐字不同，且关键数字必须真的不同 ----
function selfCheck() {
  const s = payload[0];
  const built = {};
  Object.keys(GROUPS).forEach((g) => { built[g] = buildMsgs(s, g); });
  console.log('=== 消融开关自检（历史教训：没做真消融就不要报消融结论）===');
  const lens = Object.keys(GROUPS).map((g) => built[g].text.length);
  console.log('　提示词长度：ON ' + lens[0] + ' / BARE ' + lens[1] + ' / OFF ' + lens[2]);
  const uniq = new Set(Object.keys(GROUPS).map((g) => built[g].text)).size;
  const okWords = built.on.text !== built.bare.text;
  const okNum = built.bare.text !== built.off.text;
  console.log('　三组文本互不相同：' + (uniq === 3 ? '是' : '否（' + uniq + '/3）'));
  console.log('　ON 与 BARE 差异＝说明文字：' + (okWords ? '是' : '否'));
  console.log('　BARE 与 OFF 差异＝数字：' + (okNum ? '是' : '否'));
  let numDiff = 0;
  payload.forEach((x) => {
    const t = buildMsgs(x, 'bare').text, o = buildMsgs(x, 'off').text;
    if (t !== o) numDiff++;
  });
  console.log('　全 ' + payload.length + ' 场景中 BARE≠OFF 的：' + numDiff + '（数字真差异）');

  // 防串组断言：BARE 只关文字，数字必须与 ON 完全一致；且必须与 OFF 不同。
  // 这条断言是为了防一类具体事故：消融开关是模块级全局变量，多场景并发时
  // 若在 await 之后再读引擎数字，会读到别的场景的开关 → 各组数字串位（已发生过一次）。
  let sameAsOn = 0, diffFromOff = 0;
  payload.forEach((x) => {
    const a = buildMsgs(x, 'on').info, b = buildMsgs(x, 'bare').info, o = buildMsgs(x, 'off').info;
    if (JSON.stringify(a) === JSON.stringify(b)) sameAsOn++;
    if (JSON.stringify(b) !== JSON.stringify(o)) diffFromOff++;
  });
  console.log('　BARE 数字 == ON 数字：' + sameAsOn + '/' + payload.length + '（应为全等）');
  console.log('　BARE 数字 != OFF 数字：' + diffFromOff + '/' + payload.length + '（应有差异，否则白跑）');
  LY.setAblation({ relationRules: true, yaoLayer: true, layerWords: true });
  return uniq === 3 && okWords && okNum && sameAsOn === payload.length;
}

const results = [];
let done = 0;

async function runOne(s) {
  const outs = {}, infos = {}, hard = {};
  for (const g of Object.keys(GROUPS)) {
    const b = buildMsgs(s, g);           // 同步块内已固定本组数字
    infos[g] = b.info;
    outs[g] = await callLLM(b.msgs, s.gua + '/' + g);
    hard[g] = hardMetrics(outs[g], infos[g]);
    hard[g].dirInText = dirOfText(outs[g] || '');
    hard[g].dirMatch = (hard[g].dirInText === 0 || infos[g].net === null) ? null
      : (hard[g].dirInText === Math.sign(infos[g].net) ? 1 : 0);
  }
  const judgeTxt = await callLLM([{ role: 'system', content: SYS_REVIEW },
    { role: 'user', content: buildReviewPrompt(s, outs, infos) }], s.gua + '/judge');
  const j = parseJudge(judgeTxt);

  done++;
  const rec = { gua: s.gua, month: s.month, day: s.day, useLq: s.useLq, mod: s.mod, kind: s.kind,
    infos, hard, outs, judgeRaw: judgeTxt, judge: j };
  results.push(rec);
  console.log('[' + done + '/' + scenes.length + '] ' + s.gua + ' ' + s.month + s.day + ' 用神' + s.useLq
    + '(' + s.kind + ')\n　分数 ON ' + (j ? j.on.total : '?') + ' / BARE ' + (j ? j.bare.total : '?')
    + ' / OFF ' + (j ? j.off.total : '?') + '　优：' + (j ? j.best : '?')
    + '\n　复述本组数字：用神分 ' + ['on', 'bare', 'off'].map((g) => g + '=' + (hard[g].citeYs ? '√' : '×')).join(' ')
    + '　净力 ' + ['on', 'bare', 'off'].map((g) => g + '=' + (hard[g].citeNet ? '√' : '×')).join(' ')
    + '\n　方向与本组一致：' + ['on', 'bare', 'off'].map((g) => g + '=' + (hard[g].dirMatch === null ? '?' : (hard[g].dirMatch ? '√' : '×'))).join(' '));
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8');
}

function report() {
  const scored = results.filter((r) => r.judge);
  if (!scored.length) { console.log('\n无有效评审结果。'); return; }
  const n = scored.length;
  const avg = (g, path) => scored.reduce((a, r) => a + (r.judge[g][path] || 0), 0) / n;
  console.log('\n================ 数字下沉消融结果（' + n + ' 例）================');
  console.log('评审均分（0-6）：　ON ' + avg('on', 'total').toFixed(2)
    + '　BARE ' + avg('bare', 'total').toFixed(2) + '　OFF ' + avg('off', 'total').toFixed(2));
  ['cons', 'basis', 'xiang'].forEach((k) => {
    console.log('　' + k + '：　ON ' + avg('on', k).toFixed(2) + '　BARE ' + avg('bare', k).toFixed(2)
      + '　OFF ' + avg('off', k).toFixed(2));
  });
  const best = { on: 0, bare: 0, off: 0 };
  scored.forEach((r) => { if (r.judge.best && best[r.judge.best] !== undefined) best[r.judge.best]++; });
  console.log('评审最优组：　ON ' + best.on + ' / BARE ' + best.bare + ' / OFF ' + best.off);

  console.log('\n---- 硬指标：断语是否复述本组给出的数字（越高=越没绕开）----');
  ['citeYs', 'citeJi', 'citeNet'].forEach((k) => {
    const c = (g) => scored.filter((r) => r.hard[g][k]).length;
    console.log('　' + k.padEnd(8) + ' ON ' + c('on') + '/' + n + '　BARE ' + c('bare') + '/' + n + '　OFF ' + c('off') + '/' + n);
  });
  console.log('\n---- 硬指标：断语吉凶方向是否与本组净力方向一致（绕开的直接证据）----');
  const dm = (g) => scored.filter((r) => r.hard[g].dirMatch === 1).length;
  const dn = (g) => scored.filter((r) => r.hard[g].dirMatch !== null).length;
  ['on', 'bare', 'off'].forEach((g) => {
    console.log('　' + g.padEnd(5) + ' ' + dm(g) + '/' + dn(g));
  });

  // 方向翻转场景下的"串味"检查：OFF 与 ON 数字方向相反时，OFF 组是否给出 ON 组的吉凶方向
  const flip = scored.filter((r) => r.infos.on.net !== null && r.infos.off.net !== null
    && Math.sign(r.infos.on.net) !== Math.sign(r.infos.off.net));
  if (flip.length) {
    const leak = flip.filter((r) => r.hard.off.dirMatch === 0).length;
    const onHit = flip.filter((r) => r.hard.on.dirMatch === 1).length;
    console.log('\n---- 方向翻转场景下的定向检验（' + flip.length + ' 例，两组数字吉凶相反）----');
    console.log('　OFF 组仍说出与 OFF 数字相反的吉凶方向：' + leak + '/' + flip.length + '（应为高值，见下方结论）');
    console.log('　ON  组方向与 ON 数字一致：' + onHit + '/' + flip.length);
  }
}

(async function () {
  console.log('待跑场景 ' + scenes.length + ' 个（每场景 3 次生成 + 1 次评审 = ' + scenes.length * 4 + ' 次请求）\n');
  if (!selfCheck()) { console.error('\n自检未通过：开关未真实生效，中止（不报消融结论）。'); process.exit(1); }
  console.log('');
  const CONC = 3;
  for (let i = 0; i < scenes.length; i += CONC) {
    const batch = scenes.slice(i, i + CONC);
    try { await Promise.all(batch.map(runOne)); }
    catch (e) { console.error('批次失败（' + i + ' 起）：', e.message); }
    await new Promise((r) => setTimeout(r, 500));
  }
  LY.setAblation({ relationRules: true, yaoLayer: true, layerWords: true });
  report();
})();
