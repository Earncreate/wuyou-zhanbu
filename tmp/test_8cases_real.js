// 真 LLM 受控实验：4 专属模块 + 通用 × 4 同问
// 运行： WY_BASE=https://xxx/v1 WY_MODEL=gpt-4o WY_KEY=sk-xxx node test_8cases_real.js
// 未设 key 时只打印将要发送的消息，不发起请求。
const fs = require('fs');
const path = require('path');
const CFG = require('../libs/config.js');
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');

const WY_BASE = process.env.WY_BASE || '';
const WY_MODEL = process.env.WY_MODEL || '';
const WY_KEY = process.env.WY_KEY || '';

// 4 组（同卦配对专属模块 vs 通用模块），与 test_8cases.js 完全一致
const CASES = [
  { modId: 'loveM', q: '最近和对象总吵架，想问这段感情还能不能走下去',
    six: [{sum:9},{sum:8},{sum:7},{sum:6},{sum:7},{sum:8}], monthGanZhi: '丙寅', dayGanZhi: '甲子' },
  { modId: 'wealth', q: '想问最近这个小生意能不能赚到钱',
    six: [{sum:6},{sum:7},{sum:8},{sum:9},{sum:7},{sum:8}], monthGanZhi: '丙寅', dayGanZhi: '甲子' },
  { modId: 'career', q: '想知道今年我在单位能不能升职',
    six: [{sum:8},{sum:9},{sum:7},{sum:6},{sum:8},{sum:7}], monthGanZhi: '丙寅', dayGanZhi: '甲子' },
  { modId: 'illness', q: '最近老咳嗽睡不好，想问这病什么时候能好',
    six: [{sum:9},{sum:6},{sum:8},{sum:7},{sum:9},{sum:6}], monthGanZhi: '丙寅', dayGanZhi: '甲子' }
];

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

async function main() {
  const results = [];
  // 4 卦 Stage1 各跑一次（与模块无关），供专属/通用复用
  const stage1ByHex = {};
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const chart = LY.arrange({ six: c.six, monthGanZhi: c.monthGanZhi, dayGanZhi: c.dayGanZhi });
    const hexKey = chart.ben.name + (chart.bian ? ' 之 ' + chart.bian.name : '');
    const s1 = CFG.buildStage1Messages(c.modId, c.q, chart);
    console.log('[' + (i + 1) + '] 起卦: ' + hexKey + ' 动爻=' + (chart.movingCount));
    if (!WY_KEY) {
      console.log('   Stage1 system 预览(前120字): ' + s1[0].content.slice(0, 120).replace(/\n/g, ' '));
    } else {
      stage1ByHex[hexKey] = await callLLM(s1);
      console.log('   Stage1 完成(' + stage1ByHex[hexKey].length + '字)');
    }
    c._chart = chart; c._hexKey = hexKey;
  }

  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const s1text = WY_KEY ? stage1ByHex[c._hexKey] : '（总断占位）';
    for (const mod of [c.modId, 'general']) {
      const s2 = CFG.buildStage2Messages(mod, c.q, c._chart, s1text);
      const injFragment = SYM.selectSymbols(c._chart, mod);
      if (!WY_KEY) {
        console.log('  · [' + mod + '] 选择器注入长度=' + injFragment.length + '字');
        results.push({ case: i + 1, modId: mod, q: c.q, hex: c._hexKey, injectedLen: injFragment.length, output: '(未配key)' });
      } else {
        const out = await callLLM(s2);
        console.log('  · [' + mod + '] 产出 ' + out.length + '字');
        results.push({ case: i + 1, modId: mod, q: c.q, hex: c._hexKey, injectedLen: injFragment.length, output: out });
      }
    }
  }

  const outPath = path.join(__dirname, 'real_outputs.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log('\n结果已写入: ' + outPath + (WY_KEY ? '（含真实模型输出）' : '（仅注入统计，未发请求）'));
}

main().catch(function (e) { console.error('运行失败:', e.message); process.exit(1); });
