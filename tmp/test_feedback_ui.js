#!/usr/bin/env node
/** 应验反馈前端测试：jsdom 载入 index.html，接真实后端（需先起 uvicorn 8123）
 *
 *  重点验证三件事：
 *  1 反馈写在记录上（rec.feedback），不是另存字典 —— 否则永远上不了云
 *  2 结果页点等级 → 自动存记录 → 反馈随记录同步到云端 → 换设备能拉回
 *  3 历史里能对已保存的记录补反馈/改反馈（用户当下没反馈、事后回来看记录再填）
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
    window.scrollTo = function () { };
    const mem = {
      wy_key: 'sk-test-stub', wy_base: 'https://api.deepseek.com/v1',
      wy_model: 'deepseek-chat', wy_quick: '1'
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k) => (k in mem ? mem[k] : null),
        setItem: (k, v) => { mem[k] = String(v); },
        removeItem: (k) => { delete mem[k]; },
        clear: () => { for (const k in mem) delete mem[k]; }
      }
    });
    // 大模型调用走桩（不烧 Key、不联网），其余请求放行到真实后端
    window.fetch = (u, o) => {
      if (String(u).indexOf('/chat/completions') >= 0) {
        return Promise.resolve(new Response(
          'data: {"choices":[{"delta":{"content":"测试解读：用神旺相，可成。"}}]}\n\n' +
          'data: {"choices":[{"delta":{"content":"应期在秋后。"}}]}\n\n' +
          'data: [DONE]\n\n',
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        ));
      }
      return fetch(u, o);
    };
    window.TextDecoder = TextDecoder;
    window.crypto = require('crypto').webcrypto;
  }
});
const { window } = dom;
const doc = window.document;

function click(el) {
  if (!el) throw new Error('click: 元素不存在');
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}
function hist() {
  try { return JSON.parse(window.localStorage.getItem('wy_records') || '[]'); } catch (e) { return []; }
}

async function main() {
  await new Promise((r) => window.addEventListener('load', r));
  await sleep(250);
  const CL = window.WYCloud;

  // 打开云同步：设服务地址后重载一次，让 cloud.config 生效
  window.localStorage.setItem('wy_api_base', API);
  console.log('【0】接线：登录（用 root 现场发码，测试可反复跑）');
  CL.setBase(API);
  chk('云同步已启用', CL.enabled() === true, CL.base());
  await CL.login('root', '886260');
  chk('root 登录成功', CL.authed() === true, CL.user());
  const codes = await CL.createInvites(1);
  const code = codes.codes[0];
  const uname = 'fbU' + Date.now().toString(36);
  await CL.register(uname, 'abc123', code);
  chk('测试账号注册成功', CL.authed() && CL.user() === uname, CL.user());

  console.log('【1】起一卦 → 解析（大模型走桩，不烧 Key）→ 进结果页');
  click(doc.querySelectorAll('#modList .mod-card')[0]);
  await sleep(120);
  click(doc.querySelector('.cast-btn[data-cast="manual"]'));
  await sleep(80);
  doc.querySelectorAll('.cast-yao-row').forEach(function (row, i) {
    row.querySelectorAll('button').forEach(function (b) {
      b.classList.remove('on');
      if (b.dataset.sum === (i === 0 ? '9' : '8')) b.classList.add('on');
    });
  });
  click(doc.querySelector('#btnCastManual'));
  await sleep(300);
  chk('已成卦', /成卦：/.test((doc.querySelector('#tossTip') || {}).textContent || ''),
    (doc.querySelector('#tossTip') || {}).textContent);
  const ta = doc.querySelector('#askText');
  if (ta) { ta.value = '这笔投资能赚吗'; ta.dispatchEvent(new window.Event('input', { bubbles: true })); }
  const goRes = doc.querySelector('#btnToResult') || doc.querySelector('#btnParse') ||
    doc.querySelector('.btn-main.big');
  if (goRes) click(goRes);
  await sleep(1500);   // 等两段解析跑完（桩返回很快，主要是节流与渲染）
  chk('结果页有解读正文', !!doc.querySelector('#aiOut'), doc.querySelector('#resBox') ? '有 resBox' : '无 resBox');
  chk('结果页出现卦象卡', !!doc.querySelector('.gua-brief') || /起卦时间|四柱/.test(doc.querySelector('#resBox').textContent),
    doc.querySelector('#resBox').textContent.slice(0, 60));

  console.log('【2】结果页直接点等级：应自动存记录并挂上反馈');
  const before = hist().length;
  const lvBtn = doc.querySelector('[data-fblevel="4"]');
  chk('结果页出现五个等级按钮', !!lvBtn, doc.querySelector('#fbRow') ? doc.querySelector('#fbRow').textContent.slice(0, 60) : '无 fbRow');
  click(lvBtn);
  await sleep(300);
  const after = hist();
  chk('自动存了一条记录', after.length === before + 1, before + '→' + after.length);
  const rec = after[0];
  chk('反馈挂在记录上（不是另存字典）', !!(rec && rec.feedback && rec.feedback.level === 4),
    JSON.stringify(rec && rec.feedback));
  chk('旧字典已被清掉', window.localStorage.getItem('wy_feedback') === null,
    window.localStorage.getItem('wy_feedback'));
  chk('结果页显示已记录', /已记录：完全应验/.test(doc.querySelector('#fbRow').textContent),
    doc.querySelector('#fbRow').textContent.slice(0, 80));

  console.log('【3】反馈随记录同步到云端');
  await CL.sync(after);
  await sleep(300);
  const stats = await CL.myStats();
  chk('云端收到 1 条记录', stats.total === 1, JSON.stringify(stats.total));
  chk('云端认到这条反馈', stats.overall.feedbackCount === 1, JSON.stringify(stats.overall));
  chk('云端应验率 100%', stats.overall.rate === 100.0, stats.overall.rate);

  console.log('【4】在历史里改反馈（当下没反馈、事后回来补的场景）');
  const fbCell = doc.querySelector('.rec-fb');
  chk('历史行有反馈入口', !!fbCell, doc.querySelector('#historyDrawerBody') ? '有抽屉' : '无抽屉');
  click(fbCell);
  await sleep(120);
  chk('弹层已打开', doc.querySelector('#fbMask').classList.contains('show'));
  chk('弹层里列出五个等级', doc.querySelectorAll('#fbOpts [data-fbv]').length === 5,
    doc.querySelectorAll('#fbOpts [data-fbv]').length);
  chk('弹层预选当前等级', !!doc.querySelector('#fbOpts .fb-opt.on[data-fbv="4"]'));
  click(doc.querySelector('#fbOpts [data-fbv="1"]'));
  await sleep(60);
  chk('改选后高亮跟着变', !!doc.querySelector('#fbOpts .fb-opt.on[data-fbv="1"]'));
  doc.querySelector('#fbNote').value = '后来亏了，断反了';
  click(doc.querySelector('#fbOk'));
  await sleep(300);
  const rec2 = hist()[0];
  chk('改后的等级写回记录', rec2.feedback.level === 1, JSON.stringify(rec2.feedback));
  chk('备注也存下来了', rec2.feedback.note === '后来亏了，断反了', rec2.feedback.note);
  chk('弹层已关闭', !doc.querySelector('#fbMask').classList.contains('show'));

  console.log('【5】改完同步，云端统计跟着变');
  await CL.sync(hist());
  await sleep(300);
  const s2 = await CL.myStats();
  chk('云端应验率降为 0%', s2.overall.rate === 0.0, s2.overall.rate);
  // 换 root 身份看明细：普通用户调管理员接口应被拒（后端已测 403，这里只验 root 能看）
  await CL.login('root', '886260');
  const detail = await CL.adminFeedback({ username: uname });
  chk('root 能在明细里看到这条备注', detail.items.some((x) => x.note === '后来亏了，断反了'),
    JSON.stringify(detail.items.map((x) => x.note)));
  await CL.login(uname, 'abc123');
  chk('切回测试账号', CL.user() === uname, CL.user());

  console.log('【6】换设备：清空本地与同步游标后从云端拉回，反馈还在');
  // 真实换设备 = 全新浏览器：本地无记录、同步游标为 0（不清游标的话增量同步本就拉不到，属正常行为）
  window.localStorage.setItem('wy_records', '[]');
  window.localStorage.removeItem('wy_sync_ts');
  window.localStorage.removeItem('wy_pending');
  const remote = await CL.sync([]);
  await sleep(200);
  const pulled = (remote && remote.merged) ? remote.merged : [];
  const withFb = pulled.filter((r) => r && r.feedback && r.feedback.level);
  chk('拉回的记录里带着反馈', withFb.length === 1, JSON.stringify(pulled.map((r) => r && r.feedback)));
  chk('拉回的等级正确', withFb[0] && withFb[0].feedback.level === 1, withFb[0] && withFb[0].feedback.level);

  console.log('【7】旧字典迁移（老用户升级后反馈不至于丢）');
  window.localStorage.setItem('wy_feedback', JSON.stringify({
    'wealth|乾为天|2026-10-04 12:00': '部分应验'
  }));
  window.localStorage.setItem('wy_records', JSON.stringify([
    { id: 'rOld1', moduleId: 'wealth', gua: '乾为天', beijing: '2026-10-04 12:00', text: '旧卦' }
  ]));
  const migrated = window.__wyTest.migrateLegacyFeedback();
  chk('迁移函数可调用', typeof migrated === 'number', migrated);
  chk('老反馈迁到记录上', migrated === 1, migrated);
  const oldRec = hist()[0];
  chk('旧「部分应验」映射为基本应验(3)', oldRec.feedback && oldRec.feedback.level === 3,
    JSON.stringify(oldRec.feedback));
  chk('迁移后字典被清掉', window.localStorage.getItem('wy_feedback') === null);

  console.log('【8】本机准头统计');
  const statHTML = window.__wyTest.feedbackStatsHTML();
  chk('统计里出现反馈数', /共反馈/.test(statHTML), statHTML.slice(0, 80));
  chk('登录时提示会同步云端', /同步到云端/.test(statHTML), statHTML.slice(60, 160));

  console.log('【9】无脚本错误');
  chk('全程无 jsdom/script 错误', errors.length === 0, errors.join(' | '));

  console.log('\n======== 反馈测试汇总 ========');
  console.log('通过 ' + pass + '，失败 ' + fail.length);
  if (fail.length) fail.forEach((f) => console.log('  ✗ ' + f));
  process.exit(fail.length ? 1 : 0);
}

main().catch((e) => { console.error('崩了：', e); process.exit(1); });
