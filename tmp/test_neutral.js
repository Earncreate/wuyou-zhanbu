/* 中性问句双跑压模块价值
 * 设计：同一句"不带任何领域词"的用户问 → 同一卦(同月日) → 共用同一份 Stage1 总断 →
 *       分别走【通用模块 general】与【指定模块 mod】，只隔离 Stage2 的章法注入差异。
 *       若指定模块仍能锚定正确用神+贴域章法，而通用模块漂移(用神错/章法泛/取象串神)，
 *       即证明"模块"在中性问句下确实有增量价值。
 * 运行： WY_BASE=https://api.deepseek.com/v1 WY_MODEL=deepseek-chat WY_KEY=sk-xxx node test_neutral.js
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
function ganzhiIndex(gz) { const s = STEMS.indexOf(gz[0]), b = BRANCHES.indexOf(gz[1]); for (let p = 0; p < 60; p++) if (p % 10 === s && p % 12 === b) return p; return -1; }
function kongBranches(dgz) {
  const t = {'甲子':['戌','亥'],'甲戌':['申','酉'],'甲申':['午','未'],'甲午':['辰','巳'],'甲辰':['寅','卯'],'甲寅':['子','丑']};
  const idx = ganzhiIndex(dgz); let h = null;
  for (const k of Object.keys(t)) if (ganzhiIndex(k) <= idx && idx < ganzhiIndex(k) + 10) h = k;
  return t[h] || ['?','?'];
}

// 中性问句：完全不出现 感情/财/病/事业/学/失物 等任何领域词
const NEUTRAL = '我心里一直有个事放不下，想问问这件事到底怎么样，是成是败、是吉是凶？';

// 用 T1(书案例原始)月日，确保用神在卦且不被空破干扰，干净检验"中性问句下模块能否锚定"
const CASES = [
  { key: 'H1既济→loveM', six: [{sum:9},{sum:8},{sum:7},{sum:6},{sum:7},{sum:8}], mod: 'loveM', monthGanZhi: '丙寅', dayGanZhi: '甲子' },
  { key: 'H2困→illness', six: [{sum:6},{sum:7},{sum:8},{sum:9},{sum:7},{sum:8}], mod: 'illness', monthGanZhi: '丙寅', dayGanZhi: '甲子' },
  { key: 'H3蛊→career',  six: [{sum:8},{sum:9},{sum:7},{sum:6},{sum:8},{sum:7}], mod: 'career', monthGanZhi: '丙寅', dayGanZhi: '甲子' },
  { key: 'H4随→wealth',  six: [{sum:9},{sum:6},{sum:8},{sum:7},{sum:9},{sum:6}], mod: 'wealth', monthGanZhi: '丙寅', dayGanZhi: '甲子' }
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function callLLM(messages) {
  if (!WY_KEY) return Promise.resolve('(未配置 WY_KEY)');
  const url = WY_BASE.replace(/\/$/, '') + '/chat/completions';
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + WY_KEY },
    body: JSON.stringify({ model: WY_MODEL, messages: messages, temperature: 0.7, stream: true }) })
    .then(r => { if (!r.ok) return r.text().then(t => { throw new Error('HTTP ' + r.status + ' ' + t.slice(0,160)); });
      const reader = r.body.getReader(); const dec = new TextDecoder('utf-8'); let buf = '', acc = '';
      return (function pump() { return reader.read().then(rr => { if (rr.done) return acc;
        buf += dec.decode(rr.value, { stream: true }); const parts = buf.split('\n'); buf = parts.pop();
        parts.forEach(line => { line = line.trim(); if (line.indexOf('data:') !== 0) return;
          const p = line.slice(5).trim(); if (p === '[DONE]') return;
          try { const j = JSON.parse(p); const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content; if (d) acc += d; } catch (e) {} });
        return pump(); }); })();
    });
}

function factsOf(chart, modId) {
  const useLq = SYM.MOD_USE ? SYM.MOD_USE[modId] : null;
  const cands = chart.ben.yaos.filter(y => y.liuqin === useLq);
  return { modId, useLq, onChart: cands.length > 0 };
}

function judgeMessages(neutralQ, facts, genOut, specOut) {
  const sys = [
    '你是六爻评审。下方有对同一卦、同一句中性问句的两个回答：A=通用模块(无领域章法)，B=指定模块(' + facts.modId + ')。',
    '请判断"指定模块相比通用模块是否产生增量价值"。只输出一个 JSON，不要其他文字。',
    '输出字段：',
    'expectedUseShen(本模块规定用神六亲=' + facts.useLq + '，用神在卦=' + (facts.onChart ? '是' : '否(伏藏)') + ')；',
    'genUseShen(通用回答把哪个六亲当主轴/用神，或"未明确")；',
    'specUseShen(指定回答把哪个六亲当用神)；',
    'genDrift(布尔：通用是否漂移——用神选错/章法泛泛不贴领域/取象串到别的领域)；',
    'chapterApplied(布尔：指定回答是否启用' + facts.modId + '章法)；',
    'moduleWins(布尔：指定明显优于通用——用神对+章法贴域)；',
    'scoreGen(0-10：通用在中性问句下的回答质量)；',
    'scoreSpec(0-10：指定模块的回答质量)；',
    'delta(=scoreSpec-scoreGen，模块增量)；',
    'notes(中文简述差异与原因)。'
  ].join('\n');
  const user = [
    '【中性问句】' + neutralQ,
    '【卦实况】规定用神=' + facts.useLq + '(' + (facts.onChart ? '在卦' : '伏藏') + ')，旬空=' + facts.kong.join('') + '空',
    '【A 通用模块回答】\n' + genOut,
    '【B 指定模块(' + facts.modId + ')回答】\n' + specOut
  ].join('\n');
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}

function parseJudge(t) { try { const m = t.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch (e) {} return { parse_error: true, raw: t.slice(0,300) }; }

async function main() {
  const results = [];
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const chart = LY.arrange({ six: c.six, monthGanZhi: c.monthGanZhi, dayGanZhi: c.dayGanZhi });
    const hexKey = chart.ben.name + (chart.bian ? ' 之 ' + chart.bian.name : '');
    const f = factsOf(chart, c.mod); f.kong = kongBranches(c.dayGanZhi);
    console.log('[' + (i + 1) + '] ' + c.key + ' 卦=' + hexKey + ' 用神=' + f.useLq + '(' + (f.onChart ? '在卦' : '伏藏') + ') 旬空=' + f.kong.join('') + '空');
    if (!WY_KEY) { console.log('   (未配 key)'); results.push({ case: c.key, facts: f }); continue; }
    // 通用路：Stage1+Stage2 都用 general（用户未选模块）
    const s1gen = await callLLM(CFG.buildStage1Messages('general', NEUTRAL, chart));
    console.log('   Stage1(通用)(' + s1gen.length + '字)'); await sleep(700);
    const gen = await callLLM(CFG.buildStage2Messages('general', NEUTRAL, chart, s1gen));
    console.log('   通用 Stage2(' + gen.length + '字)'); await sleep(700);
    // 指定路：Stage1+Stage2 都用指定模块（对齐生产：用户选了该模块）
    const s1spec = await callLLM(CFG.buildStage1Messages(c.mod, NEUTRAL, chart));
    console.log('   Stage1(指定)(' + s1spec.length + '字)'); await sleep(700);
    const spec = await callLLM(CFG.buildStage2Messages(c.mod, NEUTRAL, chart, s1spec));
    console.log('   指定 Stage2(' + spec.length + '字)'); await sleep(700);
    const jr = await callLLM(judgeMessages(NEUTRAL, f, gen, spec));
    const j = parseJudge(jr);
    console.log('   评审: moduleWins=' + j.moduleWins + ' genDrift=' + j.genDrift + ' delta=' + j.delta + ' (' + (j.scoreSpec||'?') + '-' + (j.scoreGen||'?') + ')');
    results.push({ case: c.key, hex: hexKey, facts: f, stage1gen: s1gen, stage1spec: s1spec, general: gen, specific: spec, judge: j });
  }
  const out = path.join(__dirname, 'neutral_test.json');
  fs.writeFileSync(out, JSON.stringify(results, null, 2), 'utf-8');
  let rep = '中性问句双跑 · 模块价值压测报告\n同一中性问句 / 同卦 / 共用Stage1 / 通用 vs 指定模块\n\n';
  let wins = 0, drift = 0, sumDelta = 0;
  for (const r of results) {
    rep += '────────────────────────\n' + r.case + '  ' + (r.hex || '') + '\n';
    rep += '用神=' + r.facts.useLq + '(' + (r.facts.onChart ? '在卦' : '伏藏') + ') 旬空=' + r.facts.kong.join('') + '空\n';
    if (r.judge && !r.judge.parse_error) {
      const j = r.judge;
      rep += '通用用神=' + j.genUseShen + ' | 指定用神=' + j.specUseShen + ' | 规定用神=' + j.expectedUseShen + '\n';
      rep += '通用漂移=' + j.genDrift + ' 章法启用=' + j.chapterApplied + ' 模块胜出=' + j.moduleWins + '\n';
      rep += '通用质量=' + j.scoreGen + ' 指定质量=' + j.scoreSpec + ' 增量delta=' + j.delta + '\n';
      rep += '评审注：' + (j.notes || '') + '\n';
      if (j.moduleWins) wins++; if (j.genDrift) drift++; if (typeof j.delta === 'number') sumDelta += j.delta;
    } else rep += '(未评审)\n';
  }
  rep += '\n────────────────────────\n模块胜出=' + wins + '/' + results.length + '  通用漂移=' + drift + '/' + results.length + '  平均增量delta=' + (results.length ? (sumDelta / results.length).toFixed(1) : '-') + '\n';
  fs.writeFileSync(path.join(__dirname, 'neutral_test_report.txt'), rep, 'utf-8');
  console.log('\n结果: ' + out + ' / neutral_test_report.txt');
}
main().catch(e => { console.error('运行失败:', e.message); process.exit(1); });
