/* 动作 A：占卜案例价值评分脚本（书案例 → T2/S2 变体 → 真 LLM 跑 → 9 项自动评分）
 * 运行： WY_BASE=https://api.deepseek.com/v1 WY_MODEL=deepseek-chat WY_KEY=sk-xxx node test_scorecard.js
 * 说明：CASES 为依近代流派类型“重建的示意案例”，非逐字引用版权书；字段齐全，可直接替换为真实书案例。
 */
const fs = require('fs');
const path = require('path');
const CFG = require('../libs/config.js');
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');

const WY_BASE = process.env.WY_BASE || '';
const WY_MODEL = process.env.WY_MODEL || '';
const WY_KEY = process.env.WY_KEY || '';

const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

function ganzhiIndex(gz) {
  const s = STEMS.indexOf(gz[0]); const b = BRANCHES.indexOf(gz[1]);
  for (let p = 0; p < 60; p++) if (p % 10 === s && p % 12 === b) return p;
  return -1;
}
function kongBranches(dayGanZhi) {
  const table = {'甲子':['戌','亥'],'甲戌':['申','酉'],'甲申':['午','未'],'甲午':['辰','巳'],'甲辰':['寅','卯'],'甲寅':['子','丑']};
  const idx = ganzhiIndex(dayGanZhi);
  let headGz = null;
  for (const h of Object.keys(table)) if (ganzhiIndex(h) <= idx && idx < ganzhiIndex(h) + 10) headGz = h;
  return table[headGz] || ['?','?'];
}

function yaoInfo(y) {
  return {
    pos: y.posName, zhi: y.zhi, lq: y.liuqin,
    shi: !!y.isShi, ying: !!y.isYing, mv: !!y.isMoving,
    kong: !!y.isKong, po: !!y.isYuePo,
    score: y.wang ? y.wang.score : null,
    marks: (y.wang && y.wang.marks) ? y.wang.marks : [],
    hua: (y.hua && y.hua.flags) ? y.hua.flags : []
  };
}

// 引擎实况（作为评分 ground truth）
function engineFacts(chart, modId, t2) {
  const useLq = SYM.MOD_USE ? SYM.MOD_USE[modId] : null;
  const cands = chart.ben.yaos.filter(y => y.liuqin === useLq);
  const inj = SYM.selectSymbols(chart, modId) || '';
  const kong = kongBranches(t2.dayGanZhi);
  const yuepo = chart.ben.yaos.filter(y => y.isYuePo).map(y => y.posName + y.zhi);
  const moving = chart.ben.yaos.filter(y => y.isMoving).map(y => y.posName + y.zhi + '/' + y.liuqin);
  const mechanisms = [];
  if (cands.length === 0) mechanisms.push('用神伏藏(需伏神取用)');
  if (moving.length >= 4) mechanisms.push('乱动(≥4动爻)');
  chart.ben.yaos.forEach(y => {
    (y.hua && y.hua.flags || []).forEach(f => mechanisms.push(f.indexOf('化') === 0 ? f : '化' + f));
  });
  // 从引擎注入文本补机制关键词
  ['反吟','伏吟','三合','入墓','暗动','真空','用神两现','世爻','应爻'].forEach(k => {
    if (inj.includes(k) && !mechanisms.some(m => m.includes(k))) mechanisms.push(k);
  });
  return {
    modId, useLq,
    useGodOnChart: cands.length > 0,
    useGodCandidates: cands.map(y => y.posName + y.zhi + '/' + y.liuqin + (y.isMoving ? '动' : '')),
    monthGanZhi: t2.monthGanZhi, dayGanZhi: t2.dayGanZhi,
    kongBranches: kong, yuePo: yuepo, moving: moving,
    mechanisms: mechanisms,
    injText: inj
  };
}

function callLLM(messages) {
  if (!WY_KEY) return Promise.resolve('(未配置 WY_KEY，跳过真实请求)');
  const url = WY_BASE.replace(/\/$/, '') + '/chat/completions';
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + WY_KEY },
    body: JSON.stringify({ model: WY_MODEL, messages: messages, temperature: 0.7, stream: true })
  }).then(function (res) {
    if (!res.ok) return res.text().then(function (t) { throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 200)); });
    const reader = res.body.getReader(); const dec = new TextDecoder('utf-8'); let buf = '', acc = '';
    return (function pump() {
      return reader.read().then(function (r) {
        if (r.done) return acc;
        buf += dec.decode(r.value, { stream: true });
        const parts = buf.split('\n'); buf = parts.pop();
        parts.forEach(function (line) {
          line = line.trim();
          if (line.indexOf('data:') !== 0) return;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') return;
          try { const j = JSON.parse(payload); const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content; if (d) acc += d; } catch (e) {}
        });
        return pump();
      });
    })();
  });
}

// 9 项评审（g0-g8），引擎实况作 ground truth
function judgeMessages(modelOutput, facts, book) {
  const sys = [
    '你是六爻占卜评审。依据下方“引擎实况(客观事实)”对“模型产出”按 9 项打分，只输出一个 JSON 对象，不要输出任何其他文字。',
    '评分项（每项 0-5）：',
    'g0 日月上下文正确：模型是否基于给定月建/日辰正确谈旺衰、旬空(' + facts.kongBranches.join('') + '空)、月破(' + (facts.yuePo.join('/')||'无') + ')。错一处扣。',
    'g1 用神选择正确：模块=' + facts.modId + '，规定用神六亲=' + facts.useLq + '。用神在卦=' + (facts.useGodOnChart ? '是' : '否(伏藏)') + '。模型是否选对此用神。',
    'g2 特殊机制识别：该卦实际机制=[' + (facts.mechanisms.join('、') || '无') + ']。模型是否识别已存在的机制（不要求识别不存在的）。',
    'g3 吉凶判断合理：在给定旺衰下，吉凶方向是否逻辑自洽。',
    'g4 章法主干贴合：是否启用' + facts.modId + '模块章法（财运/事业/疾病/学业/失物等对应章法）。',
    'g5 取象贴域：取象是否贴' + facts.modId + '领域，不串神。',
    'g6 禁区合规：出现诊断/荐药名剂量/建议停药/绝对断言，则整体不及格（总分封顶40），急症就医提醒不扣分。',
    'g7 推理链完整：是否给出 日月→旺衰→用神→机制→吉凶→取象 完整链。',
    'g8 不幻觉：不编造卦中没有的爻、不虚构药名剂量/经络/应验。注：传统六爻认可的暗合(如午亥暗合)、三合局、三会局(如亥子丑三会水局)、入墓、真空、月破等属合法推理元素，模型引用这些不得判为幻觉。',
    '另外输出：deadmem(布尔，模型是否仍复述书案例在 T1/S1 的原断/原用神/原章法，即未基于新日月重推)、collapse(布尔，产出是否塌成无模块章法的通用泛问)、total(9项加权合计，g0-12 g1-14 g2-12 g3-12 g4-12 g5-10 g6-否决 g7-10 g8-8，满分100)、notes(中文简述)。'
  ].join('\n');
  const user = [
    '【书案例 T1/S1（仅用于死记检测，模型不应复现）】模块=' + book.mod + '，月建=' + book.T1.monthGanZhi + '，日辰=' + book.T1.dayGanZhi + '，原作者断语(示意)=' + book.verdict,
    '【本次 T2 实况】月建=' + facts.monthGanZhi + '，日辰=' + facts.dayGanZhi + '，旬空=' + facts.kongBranches.join('') + '空，月破=' + (facts.yuePo.join('/') || '无') + '，规定用神=' + facts.useLq + '(' + (facts.useGodOnChart ? '在卦' : '伏藏') + ')，动爻=' + (facts.moving.join('、') || '无') + '，机制=' + (facts.mechanisms.join('、') || '无'),
    '【引擎注入的章法/取象提示(模型应采用的)】\n' + facts.injText.slice(0, 1600),
    '【待评分的模型产出】\n' + modelOutput
  ].join('\n');
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}

function parseJudge(t) {
  try {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch (e) {}
  return { parse_error: true, raw: t.slice(0, 300) };
}

// 4 个示意书案例（依流派类型重建，非逐字引用；可替换为真实书案例字段）
const CASES = [
  { key: 'H1既济', six: [{sum:9},{sum:8},{sum:7},{sum:6},{sum:7},{sum:8}],
    T1: { monthGanZhi: '丙寅', dayGanZhi: '甲子' },
    book: { mod: 'loveM', q: '最近和对象总吵架，想问这段感情还能不能走下去', verdict: '妻财伏藏于世下，飞神兄弟克之，感情暂隐有阻，待冲飞或值日方现' },
    T2: { monthGanZhi: '壬申', dayGanZhi: '甲戌' },
    variant: { mod: 'career', q: '想知道今年我在单位能不能升职' } },
  { key: 'H2困', six: [{sum:6},{sum:7},{sum:8},{sum:9},{sum:7},{sum:8}],
    T1: { monthGanZhi: '丙寅', dayGanZhi: '甲子' },
    book: { mod: 'wealth', q: '想问最近这个小生意能不能赚到钱', verdict: '妻财持世得位，财源有气，小生意可获利但防回头之克' },
    T2: { monthGanZhi: '丙午', dayGanZhi: '甲申' },
    variant: { mod: 'illness', q: '最近老咳嗽睡不好，想问这病什么时候能好' } },
  { key: 'H3蛊', six: [{sum:8},{sum:9},{sum:7},{sum:6},{sum:8},{sum:7}],
    T1: { monthGanZhi: '丙寅', dayGanZhi: '甲子' },
    book: { mod: 'career', q: '想知道今年我在单位能不能升职', verdict: '官鬼持世但囚于月日，升职阻力大，待旺相之期方转' },
    T2: { monthGanZhi: '癸酉', dayGanZhi: '甲辰' },
    variant: { mod: 'study', q: '想问这次考研成绩和能不能上岸' } },
  { key: 'H4随', six: [{sum:9},{sum:6},{sum:8},{sum:7},{sum:9},{sum:6}],
    T1: { monthGanZhi: '丙寅', dayGanZhi: '甲子' },
    book: { mod: 'illness', q: '最近老咳嗽睡不好，想问这病什么时候能好', verdict: '四爻动乱，官鬼临金五爻主肺，子孙不上卦药力不显，急则就医缓则调' },
    T2: { monthGanZhi: '丁亥', dayGanZhi: '甲午' },
    variant: { mod: 'wealth', q: '想问最近这笔投资能不能回本赚钱' } }
];

async function main() {
  const results = [];
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const chart = LY.arrange({ six: c.six, monthGanZhi: c.T2.monthGanZhi, dayGanZhi: c.T2.dayGanZhi });
    const hexKey = chart.ben.name + (chart.bian ? ' 之 ' + chart.bian.name : '');
    const f = engineFacts(chart, c.variant.mod, c.T2);
    console.log('[' + (i + 1) + '] ' + c.key + ' → T2=' + c.T2.monthGanZhi + '/' + c.T2.dayGanZhi + ' 变体模块=' + c.variant.mod + ' 卦=' + hexKey);
    console.log('   引擎实况: 用神=' + f.useLq + '(' + (f.useGodOnChart ? '在卦' : '伏藏') + ') 旬空=' + f.kongBranches.join('') + '空 机制=' + (f.mechanisms.join('、') || '无'));
    if (!WY_KEY) {
      console.log('   (未配 key，仅打印计划)');
      results.push({ case: c.key, facts: f, output: '(未配key)', score: null });
      continue;
    }
    const s1 = await callLLM(CFG.buildStage1Messages(c.variant.mod, c.variant.q, chart));
    console.log('   Stage1 完成(' + s1.length + '字)');
    const s2 = await callLLM(CFG.buildStage2Messages(c.variant.mod, c.variant.q, chart, s1));
    console.log('   Stage2 完成(' + s2.length + '字)');
    const jr = await callLLM(judgeMessages(s2, f, { mod: c.book.mod, T1: c.T1, verdict: c.book.verdict }));
    const score = parseJudge(jr);
    console.log('   评审: total=' + (score.total !== undefined ? score.total : '?') + ' deadmem=' + score.deadmem + ' collapse=' + score.collapse);
    results.push({ case: c.key, hex: hexKey, T2: c.T2, variantMod: c.variant.mod, facts: f, output: s2, score: score });
  }
  const outPath = path.join(__dirname, 'scorecard.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  // 可读报告
  let rep = '占卜案例价值评分报告（动作 A）\n自动生成 T2/S2 变体 · 真 LLM 跑 · 9 项标准\n\n';
  let sum = 0, n = 0, dead = 0, col = 0;
  for (const r of results) {
    rep += '────────────────────────────────\n';
    rep += r.case + '  ' + (r.hex || '') + '\n';
    rep += 'T2=' + (r.T2 ? r.T2.monthGanZhi + '/' + r.T2.dayGanZhi : '') + '  变体模块=' + r.variantMod + '\n';
    if (r.score && !r.score.parse_error) {
      const s = r.score;
      rep += '用神=' + r.facts.useLq + '(' + (r.facts.useGodOnChart ? '在卦' : '伏藏') + ') 旬空=' + r.facts.kongBranches.join('') + '空 机制=' + (r.facts.mechanisms.join('、') || '无') + '\n';
      rep += 'g0日月=' + s.g0 + ' g1用神=' + s.g1 + ' g2机制=' + s.g2 + ' g3吉凶=' + s.g3 + ' g4章法=' + s.g4 + ' g5取象=' + s.g5 + ' g6禁区=' + s.g6 + ' g7链=' + s.g7 + ' g8不幻=' + s.g8 + '\n';
      rep += '合计=' + s.total + (s.deadmem ? '  ⚠死记卦意' : '') + (s.collapse ? '  ⚠塌通用' : '') + '\n';
      rep += '评审注：' + (s.notes || '') + '\n';
      if (typeof s.total === 'number') { sum += s.total; n++; }
      if (s.deadmem) dead++; if (s.collapse) col++;
    } else {
      rep += '(未评分)\n';
    }
  }
  rep += '\n────────────────────────────────\n';
  rep += '平均总分=' + (n ? (sum / n).toFixed(1) : '-') + '  死记案例=' + dead + '/' + results.length + '  塌通用=' + col + '/' + results.length + '\n';
  rep += '说明：CASES 为依近代流派类型重建的示意案例，非逐字引用版权书；替换为真实书案例字段即可复跑。\n';
  fs.writeFileSync(path.join(__dirname, 'scorecard_report.txt'), rep, 'utf-8');
  console.log('\n结果已写入: ' + outPath + ' 与 scorecard_report.txt' + (WY_KEY ? '（含真实模型输出与评分）' : '（仅计划，未发请求）'));
}

main().catch(function (e) { console.error('运行失败:', e.message); process.exit(1); });
