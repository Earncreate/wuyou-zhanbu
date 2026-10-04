#!/usr/bin/env node
/**
 * 解析页空白回归测试（jsdom）
 * 背景：预览面板是 sandbox iframe（缺 allow-same-origin），读 window.localStorage 抛
 * SecurityError，把 renderResult 打断 → 「点 AI 智能体解析」后整页空白且无任何提示。
 * 本测试锁死四条：
 *   ① 沙箱环境（无 localStorage）起卦后点解析，必须有内容、无未捕获错误
 *   ② 沙箱环境 + 已填 Key，点解析同样不得空白
 *   ③ 还原「排盘被裁剪为 null、但有解读正文」的历史记录，不得空白
 *   ④ 正常环境（localStorage 可用）存储封装不改变持久化行为
 */
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('C:/Users/Yaojiawei/node_modules/jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '　' + extra : '')); }
}

function boot(opt) {
  opt = opt || {};
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
  vc.on('error', (m) => errors.push('console.error: ' + m));
  const mem = {};
  if (opt.records) mem.wy_records = JSON.stringify(opt.records);
  if (opt.key) { mem.wy_key = opt.key; mem.wy_base = 'https://api.deepseek.com/v1'; mem.wy_model = 'deepseek-chat'; }
  const dom = new JSDOM(html, {
    url: 'file://' + path.join(root, 'index.html').replace(/\\/g, '/'),
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.scrollTo = function () {};
      if (opt.sandbox) {
        // 复现沙箱环境：访问 window.localStorage 即抛 SecurityError
        Object.defineProperty(w, 'localStorage', {
          configurable: true,
          get() { const e = new Error("Failed to read the 'localStorage' property from 'Window': the document is sandboxed"); throw e; }
        });
      } else {
        Object.defineProperty(w, 'localStorage', {
          configurable: true,
          value: {
            getItem: (k) => (k in mem ? mem[k] : null),
            setItem: (k, v) => { mem[k] = String(v); },
            removeItem: (k) => { delete mem[k]; },
            clear: () => { for (const k in mem) delete mem[k]; }
          }
        });
      }
      w.fetch = () => Promise.reject(new Error('测试环境不联网'));
      w.crypto = require('crypto').webcrypto;
    }
  });
  const { window } = dom;
  const $ = (s) => window.document.querySelector(s);
  const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  return { window, $, click, sleep, errors, mem };
}

// 完整走一遍：进模块 → 摇卦 → 等成卦
async function castOne(ctx) {
  const { $, click, sleep } = ctx;
  await sleep(700);
  click($('#modList .mod-card'));
  await sleep(150);
  click($('#btnToss'));
  for (let i = 0; i < 80; i++) {
    await sleep(300);
    if ($('#chartBox') && !$('#chartBox').classList.contains('hide')) break;
  }
  return !!(/成卦/.test($('#tossTip').textContent || ''));
}

(async function main() {
  // ① 沙箱环境 + 无 Key
  {
    const ctx = boot({ sandbox: true });
    const ok = await castOne(ctx);
    ck('① 沙箱环境可成卦', ok, ctx.$('#tossTip').textContent);
    ctx.click(ctx.$('#btnAi'));
    await ctx.sleep(400);
    const len = ctx.$('#resBox').innerHTML.length;
    ck('① 沙箱环境点解析：解析页有内容（不得空白）', len > 0, 'resBox 长度 ' + len);
    ck('① 沙箱环境点解析：无未捕获错误', ctx.errors.length === 0, ctx.errors.join(' | '));
    ck('① 存储层已退化为内存模式', ctx.window.__WY_STORE__ && ctx.window.__WY_STORE__.ok() === false);
  }

  // ② 沙箱环境 + 有 Key（沙箱内无法预置存储，须用页面自身的存储封装注入，等价于用户在本页填了 Key）
  {
    const ctx = boot({ sandbox: true });
    const ok = await castOne(ctx);
    ck('② 沙箱＋Key 可成卦', ok);
    ctx.window.__WY_STORE__.set('wy_key', 'sk-test');
    ctx.window.__WY_STORE__.set('wy_base', 'https://api.deepseek.com/v1');
    ctx.window.__WY_STORE__.set('wy_model', 'deepseek-chat');
    ctx.click(ctx.$('#btnAi'));
    await ctx.sleep(600);
    const len = ctx.$('#resBox').innerHTML.length;
    ck('② 沙箱＋Key 点解析：有内容且提示调用失败', len > 0 && /调用失败/.test(ctx.$('#resBox').textContent), 'resBox 长度 ' + len);
    ck('② 沙箱＋Key：无未捕获错误', ctx.errors.length === 0, ctx.errors.join(' | '));
  }

  // ③ 还原「排盘被裁剪（chart:null）但有解读正文」的历史记录
  {
    const ctx = boot({
      key: 'sk-test',
      records: [{
        id: 'r1', moduleId: 'loveM', text: '这段感情能成吗', gua: '山水蒙 之 山地剥',
        six: [7, 8, 9, 8, 7, 7], solar: '公历 2026年10月3日', beijing: '2026-10-03 11:43 北京时间',
        chart: null, aiFinal: '测试解读正文：此卦用神旺相，事可成。', aiStage1: '', createdAt: Date.now()
      }]
    });
    await ctx.sleep(700);
    ctx.click(ctx.$('#btnHistoryFab'));
    await ctx.sleep(200);
    const row = ctx.$('.rec-row');
    ck('③ 历史记录可点开', !!row);
    if (row) ctx.click(row);
    await ctx.sleep(500);
    const txt = ctx.$('#resBox').textContent || '';
    ck('③ 排盘缺失的记录不空白', ctx.$('#resBox').innerHTML.length > 0);
    ck('③ 已还原解读正文并说明排盘缺失', /测试解读正文/.test(txt) && /排盘数据缺失/.test(txt), txt.slice(0, 60));
    ck('③ 无未捕获错误', ctx.errors.length === 0, ctx.errors.join(' | '));
  }

  // ④ 正常环境：存储封装不改变持久化行为
  {
    const ctx = boot({});
    await ctx.sleep(700);
    ctx.click(ctx.$('[data-tab="set"]'));
    await ctx.sleep(150);
    ctx.$('#apiKey').value = 'sk-persist-test';
    ctx.click(ctx.$('#btnSaveKey'));
    await ctx.sleep(200);
    ck('④ 正常环境可写入本机存储', ctx.mem.wy_key === 'sk-persist-test', String(ctx.mem.wy_key));
    ck('④ 设置页显示已配置', /已配置 Key/.test(ctx.$('#keyState').textContent));
    ck('④ 正常环境未误报沙箱', ctx.window.__WY_STORE__.ok() === true);
  }

  console.log('\n  汇总：通过 ' + pass + '，失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
