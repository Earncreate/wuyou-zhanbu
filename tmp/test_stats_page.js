#!/usr/bin/env node
/** 管理员统计页测试：jsdom 载入 stats.html，接真实后端，用 root 登录看全站反馈 */
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('C:/Users/Yaojiawei/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const API = process.env.WYZB_API || 'http://127.0.0.1:8123';
const html = fs.readFileSync(path.join(ROOT, 'stats.html'), 'utf8');

let pass = 0; const fail = [];
function chk(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 云端后端（Render 冷启动 / Supabase 跨境 RTT）下固定 sleep 会假红，统一轮询等条件
async function waitFor(fn, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeout || 10000)) {
    if (fn()) return true;
    await sleep(100);
  }
  console.log('  (等待超时: ' + (label || '') + ')');
  return false;
}
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));

const dom = new JSDOM(html, {
  url: 'file://' + path.join(ROOT, 'stats.html').replace(/\\/g, '/'),
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    const mem = {};
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k) => (k in mem ? mem[k] : null),
        setItem: (k, v) => { mem[k] = String(v); },
        removeItem: (k) => { delete mem[k]; },
        clear: () => { for (const k in mem) delete mem[k]; }
      }
    });
    window.fetch = (u, o) => fetch(u, o);
    window.crypto = require('crypto').webcrypto;
  }
});
const { window } = dom;
const doc = window.document;
const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

async function main() {
  await new Promise((r) => window.addEventListener('load', r));
  await sleep(300);
  const CL = window.WYCloud;

  console.log('【1】页面骨架');
  chk('api.js 已加载', !!CL && typeof CL.login === 'function');
  chk('默认显示登录框', doc.querySelector('#loginBox').hidden === false);
  chk('未登录时面板隐藏', doc.querySelector('#panel').hidden === true);

  console.log('【2】先造点反馈数据（用普通账号推两条带反馈的记录）');
  CL.setBase(API);
  await CL.login('root', '886260');
  const code = (await CL.createInvites(1)).codes[0];
  const uname = 'stU' + Date.now().toString(36);
  await CL.register(uname, 'abc123', code);
  const now = Date.now();
  // sync 只推待同步队列里的记录，得先 markDirty（这一步漏了的话数据根本不会上云）
  const recs = [
    { id: 'rS1', moduleId: 'wealth', gua: '乾为天', text: '投资能赚吗', createdAt: now, updatedAt: now,
      feedback: { level: 4, at: now, note: '赚了三成' } },
    { id: 'rS2', moduleId: 'career', gua: '水火既济', text: '能入职吗', createdAt: now, updatedAt: now,
      feedback: { level: 1, at: now, note: '没成' } }
  ];
  recs.forEach(function (r) { CL.markDirty(r); });
  const pushed = await CL.sync(recs);
  chk('两条已推上云端', pushed && pushed.pushed === 2, JSON.stringify(pushed && pushed.pushed));
  await sleep(200);

  console.log('【3】root 登录看全站');
  await CL.logout();
  await CL.login('root', '886260');
  chk('root 已登录', CL.authed() && CL.user() === 'root', CL.user());
  doc.querySelector('#inUser').value = 'root';
  doc.querySelector('#inPass').value = '886260';
  click(doc.querySelector('#btnLogin'));
  await waitFor(() => /反馈明细/.test(doc.querySelector('#body').textContent), 20000, '统计内容+明细渲染');

  chk('面板已显示', doc.querySelector('#panel').hidden === false);
  chk('显示当前账号 root', /root/.test(doc.querySelector('#whoName').textContent),
    doc.querySelector('#whoName').textContent);
  const body = doc.querySelector('#body').textContent;
  chk('出现全站概览', /全站概览/.test(body), body.slice(0, 60));
  chk('出现注册用户数', /注册用户/.test(body));
  chk('出现全站应验率', /全站应验率/.test(body));
  chk('出现按模块表', /按模块/.test(body));
  chk('出现按用户表', /按用户/.test(body));
  chk('出现反馈明细', /反馈明细/.test(body));

  console.log('【4】明细里有刚才那条备注');
  chk('明细含「赚了三成」', /赚了三成/.test(body), body.indexOf('赚了三成') >= 0 ? '' : body.slice(-300));
  chk('明细含「没成」', /没成/.test(body));
  chk('明细显示等级中文', /完全应验/.test(doc.querySelector('#body').innerHTML) && /未应验/.test(doc.querySelector('#body').innerHTML));

  console.log('【5】按等级筛选');
  const chip5 = doc.querySelector('.chip[data-lv="5"]');
  chk('有等级筛选按钮', !!chip5);
  click(chip5);
  await sleep(500);
  chk('筛选后仍渲染明细', /反馈明细/.test(doc.querySelector('#body').textContent));

  console.log('【6】普通账号只能看自己的');
  await CL.logout();
  await CL.login(uname, 'abc123');
  doc.querySelector('#inUser').value = uname;
  doc.querySelector('#inPass').value = 'abc123';
  click(doc.querySelector('#btnLogin'));
  await waitFor(() => /不是管理员/.test(doc.querySelector('#body').textContent), 20000, '普通账号降级渲染');
  const body2 = doc.querySelector('#body').textContent;
  chk('提示不是管理员', /不是管理员/.test(body2), body2.slice(0, 80));
  chk('改看自己的准头', /我自己的准头/.test(body2));
  chk('看不到全站概览', !/全站概览/.test(body2));

  console.log('【7】无脚本错误');
  chk('无 jsdom 错误', errors.length === 0, errors.join(' | '));

  console.log('\n======== 统计页测试汇总 ========');
  console.log('通过 ' + pass + '，失败 ' + fail.length);
  if (fail.length) fail.forEach((f) => console.log('  ✗ ' + f));
  process.exit(fail.length ? 1 : 0);
}

main().catch((e) => { console.error('崩了：', e); process.exit(1); });
