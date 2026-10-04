#!/usr/bin/env node
/** 结果页「卦象排盘」卡测试：不烧真实 Key，用桩掉的 SSE 流跑完整两段解析，
 *  检查卦名 / 六爻排盘 / 六亲 / 四柱 / 北京时间都在，且排在 AI 正文上方。 */
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('C:/Users/Yaojiawei/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '　' + extra : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
vc.on('error', (m) => errors.push('console.error: ' + m));

function sse(text) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(enc.encode('data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\n\n'));
      c.enqueue(enc.encode('data: [DONE]\n\n'));
      c.close();
    }
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
  url: 'file://' + path.join(ROOT, 'index.html').replace(/\\/g, '/'),
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.scrollTo = function () { };
    window.HTMLElement.prototype.scrollIntoView = function () { };
    const mem = {
      wy_key: 'sk-test-stub',
      wy_base: 'https://api.deepseek.com/v1',
      wy_model: 'deepseek-chat',
      wy_quick: '1'
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
    window.fetch = (u, o) => {
      if (String(u).indexOf('/chat/completions') >= 0) return Promise.resolve(sse('【测试解读正文】用神旺相，可成。'));
      return fetch(u, o);
    };
    window.TextDecoder = TextDecoder;
    window.crypto = require('crypto').webcrypto;
  }
});
const { window } = dom;
const $ = (s) => window.document.querySelector(s);
const $$ = (s) => window.document.querySelectorAll(s);
function click(el) { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); }
const txt = (el) => (el ? el.textContent : '');

(async function main() {
  await new Promise((r) => window.addEventListener('load', r));
  await sleep(600);

  console.log('【1】起一卦有动爻的卦（初爻老阳 → 地雷复）');
  click($$('#modList .mod-card')[0]);
  await sleep(100);
  const doc = window.document;
  click(doc.querySelector('.cast-btn[data-cast="manual"]'));
  await sleep(60);
  $$('.cast-yao-row').forEach(function (row, i) {
    row.querySelectorAll('button').forEach(function (b) {
      b.classList.remove('on');
      if (b.dataset.sum === (i === 0 ? '9' : '8')) b.classList.add('on');
    });
  });
  click($('#btnCastManual'));
  await sleep(300);
  ck('成卦为地雷复', /成卦：地雷复/.test(txt($('#tossTip'))), txt($('#tossTip')));

  console.log('【1b】卦图美术：上/下卦分组 + 动爻朱砂框与 ○× 记号');
  const figs = $$('#chartBox .figs .fig');
  ck('卦图已渲染', figs.length >= 1, figs.length + ' 个');
  const f0 = figs[0];
  const tris = [...f0.querySelectorAll('.fig-tri')];
  ck('分成上下卦两组，每组 3 爻',
    tris.length === 2 && tris.every((t) => t.querySelectorAll('.fig-y').length === 3),
    tris.map((t) => t.querySelectorAll('.fig-y').length).join('/'));
  ck('两组之间有中缝分隔', f0.querySelectorAll('.fig-sep').length === 1, f0.querySelectorAll('.fig-sep').length + ' 条');
  const mvRows = [...f0.querySelectorAll('.fig-y.mv')];
  ck('动爻行数 = 动爻数（初爻动）', mvRows.length === 1, mvRows.length + ' 行');
  ck('动爻带 ○/× 记号（阳动○）', /○/.test(txt(mvRows[0].querySelector('.fig-mk'))), mvRows[0].innerHTML);
  ck('动爻爻线不再是红色类 .m', !/\bm\b/.test(mvRows[0].querySelector('.ln').className),
    mvRows[0].querySelector('.ln').className);
  ck('朱砂框由 .fig-bars 承载', mvRows[0].querySelector('.fig-bars') !== null);
  ck('初爻动落在下卦（第二组）', tris[1].querySelectorAll('.fig-y.mv').length === 1, '');

  console.log('【2】点解析，等两段跑完');
  click($('#btnAi'));
  let ok = false;
  for (let i = 0; i < 60; i++) {
    if ($('#aiOut') && /测试解读正文/.test(txt($('#aiOut')))) { ok = true; break; }
    await sleep(200);
  }
  ck('AI 正文已渲染（桩流）', ok, txt($('#aiOut')).slice(0, 60));

  console.log('【3】卦象卡的内容');
  const gb = $('.gbrief');
  ck('卦象卡存在', !!gb);
  const g = txt(gb);
  ck('含卦名', /地雷复/.test(g), g.slice(0, 80));
  ck('含宫位与世应', /宫/.test(g) && /世/.test(g) && /应/.test(g));
  ck('含起卦时间与北京时间', /起卦时间/.test(g) && /北京时间/.test(g));
  ck('含四柱年月日时干支', /四柱/.test(g) &&
    /年\s*[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/.test(g) &&
    /月\s*[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/.test(g) &&
    /日\s*[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/.test(g) &&
    /时\s*[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/.test(g), g.slice(0, 200));
  ck('含旬空与月破', /旬空/.test(g) && /月破/.test(g));
  ck('含动爻说明', /动爻/.test(g) && /初爻/.test(g));
  ck('含用神', /用神/.test(g));

  const rows = $$('.gbrief .cmp-row');
  ck('排盘 6 爻 + 1 表头', rows.length === 7, '实际 ' + rows.length);
  const bodyRows = [...rows].slice(1);
  ck('每行都有六亲', bodyRows.every((r) => {
    const lq = r.querySelector('.c-lq');
    return lq && /父母|官鬼|妻财|子孙|兄弟/.test(lq.textContent);
  }));
  ck('每行都有干支', bodyRows.every((r) => /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/.test(txt(r.querySelector('.c-gz')))));
  ck('爻位列已移除（不再占左侧宽度）',
    gb.querySelectorAll('.gb-pos').length === 0,
    '残留 ' + gb.querySelectorAll('.gb-pos').length + ' 个 .gb-pos');
  ck('有变卦列（动了爻）', $$('.gbrief .c-cap').length === 2 && /变卦/.test(txt($$('.gbrief .c-cap')[1])),
    $$('.gbrief .c-cap').length + ' 列');
  ck('动爻行有高亮标记', $$('.gbrief .cmp-row.mv').length >= 1);

  console.log('【4】位置：必须在 AI 正文上方');
  const boxHtml = $('#resBox').innerHTML;
  ck('卦象卡排在 AI 正文之前', boxHtml.indexOf('gbrief') < boxHtml.indexOf('ai-out'),
    'gbrief@' + boxHtml.indexOf('gbrief') + ' aiOut@' + boxHtml.indexOf('ai-out'));
  const pos = gb.compareDocumentPosition($('#aiOut'));
  ck('DOM 顺序确凿（DOCUMENT_POSITION_FOLLOWING）', (pos & 4) === 4, String(pos));

  console.log('【5】静卦分支');
  click(doc.querySelector('.cast-btn[data-cast="manual"]'));
  await sleep(60);
  $$('.cast-yao-row').forEach(function (row) {
    row.querySelectorAll('button').forEach(function (b) { b.classList.remove('on'); if (b.dataset.sum === '8') b.classList.add('on'); });
  });
  click($('#btnCastManual'));
  await sleep(300);
  click($('#btnAi'));
  ok = false;
  for (let i = 0; i < 60; i++) {
    if ($('#aiOut') && /测试解读正文/.test(txt($('#aiOut')))) { ok = true; break; }
    await sleep(200);
  }
  const g2 = txt($('.gbrief'));
  ck('静卦显示「静卦，无动爻」', /静卦/.test(g2) && /无动爻/.test(g2), g2.slice(0, 120));
  ck('静卦无变卦列', $$('.gbrief .c-cap').length === 1, $$('.gbrief .c-cap').length + ' 列');

  console.log('【6】返回按来路回退');
  // 此刻在解析页，来路是起卦页：返回应回起卦页而不是主界面
  click(doc.querySelector('#view-res .back'));
  await sleep(60);
  ck('解析页返回 → 起卦页（上一个界面）', !$('#view-div').classList.contains('hide') && $('#view-res').classList.contains('hide'), '');
  click(doc.querySelector('#view-div .back'));
  await sleep(60);
  ck('起卦页返回 → 主页', !$('#view-home').classList.contains('hide') && $('#view-div').classList.contains('hide'), '');
  // 模拟「从历史还原解析」：主页直接进解析页，返回应回主页（而不是起卦页）
  const WT = window.__wyTest;
  click(doc.querySelector('#btnHistoryFab'));
  await sleep(60);
  const recRow = doc.querySelector('#drawerList .rec-row');
  if (recRow) {
    click(recRow); await sleep(80);
    const inRes = !$('#view-res').classList.contains('hide');
    if (inRes) {
      click(doc.querySelector('#view-res .back')); await sleep(60);
      ck('历史还原的解析页返回 → 主页（来路）', !$('#view-home').classList.contains('hide'), '');
    } else {
      click(doc.querySelector('#view-div .back')); await sleep(60);
      ck('历史还原的起卦页返回 → 主页', !$('#view-home').classList.contains('hide'), '');
    }
  } else {
    // 没有已存记录时，等价模拟「从主页进入解析页」：清栈后按真实路径走
    WT.viewStack.length = 0;
    WT.switchView('res');   // 此调用会把 home 压栈，等价于从主页进入解析页
    click(doc.querySelector('#view-res .back')); await sleep(60);
    ck('无记录时解析页返回 → 主页', !$('#view-home').classList.contains('hide'), '');
  }

  console.log('【7】无脚本错误');
  ck('全程无报错', errors.length === 0, errors.join(' | '));

  console.log('\n======== 卦象卡测试 ========');
  console.log('通过 ' + pass + '，失败 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
