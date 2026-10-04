/* 轴稳定性测试（真实 LLM，需 key）
 * 目的：用硬指标替代"印象分"，量化三件事——
 *   轴一致率     ：同一卦跑 N 次，用神/原神/忌神身份是否完全一致（不含重试干预）
 *   轴正确率     ：身份是否等于引擎锚定值
 *   有效重试率   ：首次轴错时，重试后能否纠正成功
 * 对照组：关闭轴锁（直接调 buildStage2Messages）vs 开启轴锁（runStage2Guarded）
 *
 * 运行：
 *   WY_BASE=https://api.deepseek.com/v1 WY_MODEL=deepseek-chat WY_KEY=sk-xxx \
 *   node tmp/test_axis_stability.js [runsPerCase]
 */
const fs = require('fs');
const path = require('path');
const CFG = require('../libs/config.js');
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');

const WY_BASE = process.env.WY_BASE || '';
const WY_MODEL = process.env.WY_MODEL || '';
const WY_KEY = process.env.WY_KEY || '';
const RUNS = parseInt(process.argv[2] || '3', 10);

const NEUTRAL = '我心里一直有个事放不下，想问问这件事到底怎么样，是成是败、是吉是凶？';

// 覆盖此前踩过坑的卦 + 几个新模块
const CASES = [
  { key: 'H1既济→loveM(妻财伏藏)', six: [{ sum: 9 }, { sum: 8 }, { sum: 7 }, { sum: 6 }, { sum: 7 }, { sum: 8 }], mod: 'loveM' },
  { key: 'H2困→illness(曾反置)', six: [{ sum: 6 }, { sum: 7 }, { sum: 8 }, { sum: 9 }, { sum: 7 }, { sum: 8 }], mod: 'illness' },
  { key: 'H3蛊→career', six: [{ sum: 8 }, { sum: 9 }, { sum: 7 }, { sum: 6 }, { sum: 8 }, { sum: 7 }], mod: 'career' },
  { key: 'H4随→wealth', six: [{ sum: 9 }, { sum: 6 }, { sum: 8 }, { sum: 7 }, { sum: 9 }, { sum: 6 }], mod: 'wealth' },
  { key: 'H5履→study', six: [{ sum: 7 }, { sum: 8 }, { sum: 7 }, { sum: 8 }, { sum: 9 }, { sum: 8 }], mod: 'study' },
  { key: 'H7比→job', six: [{ sum: 8 }, { sum: 8 }, { sum: 7 }, { sum: 6 }, { sum: 7 }, { sum: 8 }], mod: 'job' }
];
const MG = '丙寅', DG = '甲子';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function callLLM(messages) {
  if (!WY_KEY) return Promise.resolve('(未配置 WY_KEY)');
  const url = WY_BASE.replace(/\/$/, '') + '/chat/completions';
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + WY_KEY },
    body: JSON.stringify({ model: WY_MODEL, messages: messages, temperature: 0.7, stream: true })
  }).then(r => {
    if (!r.ok) return r.text().then(t => { throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 160)); });
    const reader = r.body.getReader(); const dec = new TextDecoder('utf-8'); let buf = '', acc = '';
    return (function pump() {
      return reader.read().then(rr => {
        if (rr.done) return acc;
        buf += dec.decode(rr.value, { stream: true }); const parts = buf.split('\n'); buf = parts.pop();
        parts.forEach(line => {
          line = line.trim(); if (line.indexOf('data:') !== 0) return;
          const p = line.slice(5).trim(); if (p === '[DONE]') return;
          try { const j = JSON.parse(p); const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content; if (d) acc += d; } catch (e) { }
        });
        return pump();
      });
    })();
  });
}

(async function main() {
  if (!WY_KEY) { console.log('未配置 WY_KEY，退出'); return; }
  const results = [];

  for (const c of CASES) {
    const chart = LY.arrange({ six: c.six, monthGanZhi: MG, dayGanZhi: DG });
    const anchor = SYM.axisAnchor(chart, c.mod);
    console.log('\n===== ' + c.key + ' 锚句: ' + (anchor ? anchor.anchor : '(无)') + ' =====');

    // Stage1 只跑一次复用（轴锁主要作用在 Stage2）
    const s1 = await callLLM(CFG.buildStage1Messages(c.mod, NEUTRAL, chart));
    console.log('  Stage1 (' + s1.length + '字)');
    await sleep(800);

    // 对照组：真正的"无轴锁"——关掉轴锁契约文本注入（opts.axisLock=false），也不做校验重试
    const ctrl = [];
    for (let i = 0; i < RUNS; i++) {
      const out = await callLLM(CFG.buildStage2Messages(c.mod, NEUTRAL, chart, s1, { axisLock: false }));
      const v = SYM.verifyAxis(chart, c.mod, out);
      ctrl.push({ ok: v.ok, reason: v.reason, found: v.found, len: out.length });
      console.log('  [对照·无轴锁] #' + (i + 1) + ' ok=' + v.ok + '  ' + v.reason);
      await sleep(800);
    }

    // 实验组：开轴锁（回抄契约 + 校验重试）
    const exp = [];
    for (let i = 0; i < RUNS; i++) {
      const r = await CFG.runStage2Guarded(
        (msgs) => callLLM(msgs),
        { modId: c.mod, userText: NEUTRAL, chart: chart, stage1Text: s1, maxRetry: 1 }
      );
      exp.push({ ok: r.axisOk, reason: r.axisReason, attempts: r.attempts, len: r.text.length });
      console.log('  [轴锁] #' + (i + 1) + ' ok=' + r.axisOk + ' 尝试' + r.attempts + '次  ' + r.axisReason);
      await sleep(800);
    }

    results.push({ case: c.key, mod: c.mod, anchor: anchor ? anchor.anchor : null, stage1: s1, control: ctrl, guarded: exp });
  }

  // ---- 汇总 ----
  function rate(arr, key) {
    const ok = arr.filter(x => x[key]).length;
    return ok + '/' + arr.length + ' (' + (ok / arr.length * 100).toFixed(0) + '%)';
  }
  const allCtrl = results.flatMap(r => r.control);
  const allExp = results.flatMap(r => r.guarded);
  // 轴一致率：同一 case 内 N 次用神身份完全相同（用 first-found 归一化后比较）
  function firstUse(arr, i) {
    const f = arr[i].found;
    return f && f.use ? f.use : '(none)';
  }
  let consCtrl = [], consExp = [];
  results.forEach(r => {
    // 对照组有 found；实验组不存 found，用 ok 近似（轴错必然身份错）
    const cSig = new Set(r.control.map(x => (x.found && x.found.use) || '(none)'));
    const eSig = new Set(r.guarded.map(x => (x.ok ? 'correct' : 'wrong')));
    consCtrl.push(cSig.size === 1 ? 1 : 0);
    consExp.push(eSig.size === 1 ? 1 : 0);
  });
  void firstUse;
  function sumRate(a) { const s = a.reduce((x, y) => x + y, 0); return s + '/' + a.length + ' (' + (s / a.length * 100).toFixed(0) + '%)'; }

  let lines = [];
  lines.push('========== 轴稳定性测试结果（每卦 ' + RUNS + ' 次，温度 0.7）==========');
  lines.push('');
  lines.push('【对照组：关轴锁（不注入轴锁契约文本、无校验重试）】');
  lines.push('  轴正确率（首次即对）  ' + rate(allCtrl, 'ok'));
  lines.push('  轴一致率（同卦N次身份唯一）' + sumRate(consCtrl));
  lines.push('');
  lines.push('【实验组：开轴锁（回抄契约 + 校验重试）】');
  lines.push('  轴正确率（最终结果）  ' + rate(allExp, 'ok'));
  lines.push('  轴一致率             ' + sumRate(consExp));
  const retried = allExp.filter(x => x.attempts > 1);
  lines.push('  触发重试次数         ' + retried.length + '/' + allExp.length
    + (retried.length ? '，其中纠正成功 ' + retried.filter(x => x.ok).length + ' 次' : '（无需重试）'));
  lines.push('');
  lines.push('【逐卦明细】');
  results.forEach(r => {
    lines.push('  ' + r.case);
    lines.push('    锚句: ' + r.anchor);
    lines.push('    对照: ' + r.control.map(x => (x.ok ? '✓' : '✗')).join(' '));
    lines.push('    轴锁: ' + r.guarded.map(x => (x.ok ? '✓' : '✗') + '(×' + x.attempts + ')').join(' '));
    r.guarded.forEach(x => { if (!x.ok) lines.push('      未通过: ' + x.reason); });
  });

  const report = lines.join('\n');
  fs.writeFileSync(path.join(__dirname, 'axis_stability.json'), JSON.stringify(results, null, 2), 'utf-8');
  fs.writeFileSync(path.join(__dirname, 'axis_stability_report.txt'), report, 'utf-8');
  console.log('\n' + report);
})();
