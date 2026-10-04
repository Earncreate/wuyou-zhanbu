#!/usr/bin/env node
/** 前端云同步测试：jsdom 载入 index.html，接真实后端（需先起 uvicorn 8123）
 *  验证：api.js 空转安全 → 登录/注册接线 → Key 云端保管 → 记录双向同步/冲突/删除 → 清空
 */
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('C:/Users/Yaojiawei/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const API = process.env.WYZB_API || 'http://127.0.0.1:8123';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0; const fail = [];
function chk(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 等条件成立：云端后端（Render 冷启动 30-50s / Supabase 跨境 RTT）下固定 sleep 会假红
async function waitFor(fn, timeout, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < (timeout || 10000)) {
    if (fn()) return true;
    await sleep(100);
  }
  console.log('  (等待超时: ' + (label || '') + ' ' + (timeout || 10000) + 'ms)');
  return false;
}

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
vc.on('error', (m) => errors.push('console.error: ' + m));

const dom = new JSDOM(html, {
  url: 'file://' + path.join(ROOT, 'index.html').replace(/\\/g, '/'),
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.HTMLElement.prototype.scrollIntoView = function () { };
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
    window.TextDecoder = TextDecoder;
    window.crypto = require('crypto').webcrypto;
  }
});
const { window } = dom;

async function main() {
  await new Promise((r) => window.addEventListener('load', r));
  await sleep(200);
  const CL = window.WYCloud;
  const doc = window.document;

  console.log('【1】离线安全（未配服务地址时整套逻辑空转）');
  chk('api.js 已加载', !!CL && typeof CL.login === 'function');
  chk('默认未启用云同步', CL.enabled() === false, 'base=' + JSON.stringify(CL.base()));
  chk('未启用时 sync 空转', (await CL.sync([])) === null);
  chk('未启用时 markDirty 不报错', (CL.markDirty({ id: 'zz' }), true));
  chk('离线态状态行提示纯离线', /纯离线/.test(doc.querySelector('#acctState').textContent),
    doc.querySelector('#acctState').textContent);
  chk('离线时登录/注册按钮仍可见（点了给指引，不再藏掉）', !doc.querySelector('#btnLogin').classList.contains('hide') && !doc.querySelector('#btnRegister').classList.contains('hide'));
  // 未填地址直接点登录：应弹指引 toast 而不是无响应
  doc.querySelector('#acctUser').value = 'someone';
  doc.querySelector('#acctPwd').value = 'pass123';
  doc.querySelector('#btnLogin').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(30);
  chk('离线点登录给出服务地址指引', /服务地址/.test(doc.querySelector('#toast').textContent),
    doc.querySelector('#toast').textContent);

  console.log('【2】接线：设置页填入地址后开启');
  doc.querySelector('#cloudBase').value = API;
  doc.querySelector('#cloudBase').dispatchEvent(new window.Event('change'));
  await sleep(50);
  chk('地址写入后 enabled', CL.enabled() === true, CL.base());
  chk('未登录时显示登录表单', !doc.querySelector('#rowUser').classList.contains('hide'));
  chk('未登录时隐藏退出按钮', doc.querySelector('#btnLogout').classList.contains('hide'));

  console.log('【3】登录（UI 点击真实后端）');
  doc.querySelector('#acctUser').value = 'root';
  doc.querySelector('#acctPwd').value = '886260';
  doc.querySelector('#btnLogin').click();
  // 不能写死 sleep：后端连的是云端 Postgres 时（bcrypt + 跨境 RTT + 冷启动）可能要好几秒，
  // 固定等待会在慢机器上假红，看着像登录坏了其实只是没等到。轮询等状态到位。
  await waitFor(() => CL.authed() === true, 15000, '登录完成');
  chk('登录成功写入 token', CL.authed() === true);
  chk('状态行显示已登录 root', /已登录：root/.test(doc.querySelector('#acctState').textContent),
    doc.querySelector('#acctState').textContent);
  chk('登录后隐藏登录表单', doc.querySelector('#rowUser').classList.contains('hide'));
  chk('登录后显示退出按钮', !doc.querySelector('#btnLogout').classList.contains('hide'));

  console.log('【4】错误口令与邀请码');
  await CL.logout();
  let err = '';
  try { await CL.login('root', 'wrong-pwd'); } catch (e) { err = e.message; }
  chk('错误密码被拒', /密码|401/.test(err), err);
  // 先用 root 登录，现场生成一次性邀请码，测试可反复跑，不消耗预置的 5 个码
  await CL.login('root', '886260');
  const fresh = await CL.createInvites(1);
  const newUser = 't' + Date.now().toString(36);
  chk('管理员可生成邀请码', !!fresh.codes && fresh.codes.length === 1, JSON.stringify(fresh));
  await CL.logout();
  err = '';
  try { await CL.register(newUser, 'abc123', fresh.codes[0]); } catch (e) { err = e.message; }
  chk('有效邀请码注册成功', err === '' && CL.user() === newUser, err || CL.user());
  err = '';
  try { await CL.register(newUser + 'x', 'abc123', fresh.codes[0]); } catch (e) { err = e.message; }
  chk('同一邀请码二次注册被拒', /已被使用/.test(err), err);
  err = '';
  try { await CL.createInvites(1); } catch (e) { err = e.message; }
  chk('普通用户不能发码', /无权限|403/.test(err), err);
  await CL.logout();
  await CL.login('root', '886260');

  console.log('【5】API Key 云端保管');
  await CL.dropKey();                      // 清掉上一轮可能残留的 Key，保证从干净状态验
  const k0 = await CL.getKey();
  chk('初始无 Key', k0.hasKey === false);
  const kp = await CL.putKey('https://api.deepseek.com/v1', 'deepseek-chat', 'sk-jsmoke1234567890');
  chk('保存 Key 成功', kp.hasKey === true);
  chk('只回掩码不回明文', /^sk-jsm/.test(kp.masked) && kp.masked.indexOf('567890') < 0, kp.masked);
  const k1 = await CL.getKey();
  chk('重取仍是掩码', !JSON.stringify(k1).includes('sk-jsmoke1234567890'));

  console.log('【6】记录双向同步');
  await CL.wipeRemote();
  const now = Date.now();
  const recA = { id: 'rF1', moduleId: 'career', gua: '乾为天', text: '问工作', createdAt: now, updatedAt: now };
  CL.markDirty(recA);
  let res = await CL.sync([recA]);
  chk('上传 1 条', res.pushed === 1, JSON.stringify(res.pushed));
  // 模拟换设备：本机存储全新（无同步水位、无待同步队列），从云端全量拉回
  window.__WY_STORE__.remove('wy_sync_ts');
  CL.clearPending();
  let back = await CL.sync([]);
  chk('换设备能拉回记录', back.merged.length === 1 && back.merged[0].gua === '乾为天',
    JSON.stringify(back.merged.map((x) => x.id)));

  const recA2 = Object.assign({}, recA, { gua: '天风姤', updatedAt: now + 5000 });
  CL.markDirty(recA2);
  res = await CL.sync([recA2]);
  chk('新版本覆盖云端', res.merged[0].gua === '天风姤', res.merged[0].gua);

  const stale = Object.assign({}, recA, { gua: '旧版本', updatedAt: now - 5000 });
  CL.markDirty(stale);
  res = await CL.sync([stale]);
  chk('旧版本不覆盖云端', res.merged[0].gua === '天风姤', res.merged[0].gua);

  CL.markDirty(recA2, true);
  res = await CL.sync([]);
  chk('删除同步生效', res.merged.length === 0, JSON.stringify(res.merged.length));

  console.log('【7】多设备合并（本地 2 条 + 云端 1 条）');
  await CL.wipeRemote();
  const b1 = { id: 'rM1', moduleId: 'wealth', gua: '巽为风', createdAt: Date.now(), updatedAt: Date.now() };
  const b2 = { id: 'rM2', moduleId: 'love', gua: '咸', createdAt: Date.now(), updatedAt: Date.now() };
  CL.markDirty(b1); CL.markDirty(b2);
  await CL.sync([b1, b2]);
  // 模拟第二台设备：本地只有 rM2 + 一条新记录 rM3
  const b3 = { id: 'rM3', moduleId: 'study', gua: '蒙', createdAt: Date.now(), updatedAt: Date.now() };
  window.__WY_STORE__.remove('wy_sync_ts');    // 第二台设备：本地没有同步水位
  CL.clearPending();
  CL.markDirty(b3);
  const dev2 = await CL.sync([b2, b3]);
  const ids = dev2.merged.map((x) => x.id).sort();
  chk('合并后三台记录都在', ids.join(',') === 'rM1,rM2,rM3', ids.join(','));

  console.log('【8】收尾');
  await CL.wipeRemote();
  await CL.dropKey();
  await CL.logout();
  chk('退出后 token 清除', CL.authed() === false);
  chk('全程无脚本错误', errors.length === 0, errors.join(' | '));

  console.log('\n======== 云同步测试汇总 ========');
  console.log('通过 ' + pass + '，失败 ' + fail.length);
  if (fail.length) { fail.forEach((f) => console.log(' - ' + f)); process.exit(1); }
  console.log('前端云同步测试全部通过');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
