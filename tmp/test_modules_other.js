// 其他模块受控实验：3 专属模块（study/job/lost）各对比通用模块，真实 LLM 产出
// 运行： WY_BASE=https://api.deepseek.com/v1 WY_MODEL=deepseek-chat WY_KEY=sk-xxx node test_modules_other.js
const fs = require('fs');
const path = require('path');
const CFG = require('../libs/config.js');
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');

const WY_BASE = process.env.WY_BASE || '';
const WY_MODEL = process.env.WY_MODEL || '';
const WY_KEY = process.env.WY_KEY || '';

// 3 个"其他模块"，每个配一个"用神持世或发动且非空"的卦，保证模块区别于通用
const CASES = [
  { modId: 'study', q: '想问今年考研能不能考上',
    six: [{sum:7},{sum:9},{sum:6},{sum:9},{sum:7},{sum:7}], monthGanZhi: '丙寅', dayGanZhi: '甲子' },
  { modId: 'job', q: '投了个心仪的岗位，想问能不能拿到这个offer',
    six: [{sum:8},{sum:6},{sum:6},{sum:6},{sum:9},{sum:8}], monthGanZhi: '丙寅', dayGanZhi: '甲子' },
  { modId: 'lost', q: '前两天把证件弄丢了，想问还能不能找回来',
    six: [{sum:8},{sum:8},{sum:6},{sum:7},{sum:7},{sum:9}], monthGanZhi: '丙寅', dayGanZhi: '甲子' }
];

function usePresent(chart, modId) {
  const useLq = SYM.MOD_USE[modId];
  if (!useLq) return 'n/a';
  const hit = chart.ben.yaos.filter(function (y) { return y.liuqin === useLq; });
  return hit.length ? (hit.length + '现' + (hit.some(function (y) { return y.isShi; }) ? '/持世' : '') + (hit.some(function (y) { return y.isMoving; }) ? '/发动' : '')) : '伏藏';
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

async function main() {
  const results = [];
  const stage1ByHex = {};
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const chart = LY.arrange({ six: c.six, monthGanZhi: c.monthGanZhi, dayGanZhi: c.dayGanZhi });
    const hexKey = chart.ben.name + (chart.bian ? ' 之 ' + chart.bian.name : '');
    const s1 = CFG.buildStage1Messages(c.modId, c.q, chart);
    console.log('[' + (i + 1) + '] 起卦: ' + hexKey + ' 动爻=' + chart.movingCount + ' | ' + c.modId + ' 用神=' + usePresent(chart, c.modId));
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
        console.log('  · [' + mod + '] 注入=' + injFragment.length + '字 产出 ' + out.length + '字');
        results.push({ case: i + 1, modId: mod, q: c.q, hex: c._hexKey, injectedLen: injFragment.length, output: out });
      }
    }
  }

  const outPath = path.join(__dirname, 'real_outputs_other.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log('\n结果已写入: ' + outPath + (WY_KEY ? '（含真实模型输出）' : '（仅注入统计，未发请求）'));
}

main().catch(function (e) { console.error('运行失败:', e.message); process.exit(1); });
