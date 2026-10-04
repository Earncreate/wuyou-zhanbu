#!/usr/bin/env node
/** UI 冒烟测试：jsdom 加载 index.html，验证起卦八法面板渲染与成卦流程，控制台错误即失败 */
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('C:/Users/Yaojiawei/node_modules/jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const errors = [];
const vc = new (require('C:/Users/Yaojiawei/node_modules/jsdom')).VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
vc.on('error', (m) => errors.push('console.error: ' + m));

const dom = new JSDOM(html, {
  url: 'file://' + path.join(root, 'index.html').replace(/\\/g, '/'),
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    // jsdom 环境桩：浏览器皆有、jsdom 缺失的能力
    window.HTMLElement.prototype.scrollIntoView = function () {};
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
    window.fetch = (u, o) => fetch(u, o); // 桥接 node fetch
    window.crypto = require('crypto').webcrypto;
  }
});
const { window } = dom;
const { document } = window;

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '　' + extra : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function click(el) { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); }
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

(async function main() {
  await sleep(600); // 等外部脚本加载
  ck('页面脚本执行（window.LiuYao 存在）', !!(window.LiuYao && window.AppConfig));
  ck('模块列表已渲染', $$('#modList .mod-card').length >= 20, '实际 ' + $$('#modList .mod-card').length);

  // 进第一个模块
  click($$('#modList .mod-card')[0]);
  await sleep(100);
  ck('进入起卦页', !$('#view-div').classList.contains('hide'));
  ck('八法按钮渲染', $$('#castGrid .cast-btn').length === 8);
  ck('默认选中「电脑自动」', $('.cast-btn.on') && $('.cast-btn.on').dataset.cast === 'auto');
  ck('原理文案展示', /铜钱法/.test($('#castPrinciple').textContent));

  // ① 电脑自动：摇卦
  const btnToss = $('#btnToss');
  ck('摇卦按钮可见（coinBased）', btnToss.style.display !== 'none');
  click(btnToss);
  await sleep(6200); // 6 爻 ×(620+260)ms + 余量
  ck('自动摇卦成卦', /成卦：/.test($('#tossTip').textContent), $('#tossTip').textContent);
  ck('排盘已渲染（本卦名出现）', /本卦/.test($('#chartBox').textContent));

  // ② 手工指定
  click(document.querySelector('.cast-btn[data-cast="manual"]'));
  await sleep(50);
  ck('手工面板渲染（6 行）', $$('.cast-yao-row').length === 6);
  ck('摇卦按钮隐藏（非 coinBased）', $('#btnToss').style.display === 'none');
  // 指定：全少阴(8) → 静卦 坤为地
  $$('.cast-yao-row').forEach(function (row) {
    row.querySelectorAll('button').forEach(function (b) { b.classList.remove('on'); if (b.dataset.sum === '8') b.classList.add('on'); });
  });
  click($('#btnCastManual'));
  await sleep(200);
  ck('手工指定成卦（坤为地）', /成卦：坤为地/.test($('#tossTip').textContent), $('#tossTip').textContent);
  // 再指定：初爻老阳 其余少阴 → 地雷复
  click(document.querySelector('.cast-btn[data-cast="manual"]'));
  await sleep(50);
  $$('.cast-yao-row').forEach(function (row, i) {
    row.querySelectorAll('button').forEach(function (b) { b.classList.remove('on'); if (b.dataset.sum === (i === 0 ? '9' : '8')) b.classList.add('on'); });
  });
  click($('#btnCastManual'));
  await sleep(200);
  ck('手工指定（初爻老阳）→ 地雷复', /成卦：地雷复/.test($('#tossTip').textContent), $('#tossTip').textContent);

  // ③ 时间起卦
  click(document.querySelector('.cast-btn[data-cast="time"]'));
  await sleep(50);
  ck('时间卦显示农历与数', /农历/.test($('#castBody').textContent) && /上卦数/.test($('#castBody').textContent));
  click($('#btnCastTime'));
  await sleep(200);
  ck('时间起卦成卦', /成卦：/.test($('#tossTip').textContent), $('#tossTip').textContent);
  // 与独立复算对账
  const Lunar = window.Lunar;
  const d = new Date();
  const bj = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60000);
  const l = Lunar.fromDate(bj);
  const Z = { '子':1,'丑':2,'寅':3,'卯':4,'辰':5,'巳':6,'午':7,'未':8,'申':9,'酉':10,'戌':11,'亥':12 };
  const s1 = Z[l.getYearZhi()] + l.getMonth() + l.getDay(), s2 = s1 + Z[l.getTimeZhi()];
  const XIAN = [null,[1,1,1],[1,1,0],[1,0,1],[1,0,0],[0,1,1],[0,1,0],[0,0,1],[0,0,0]];
  const bits = XIAN[s2 % 8 || 8].concat(XIAN[s1 % 8 || 8]);
  const mi = ((s2 % 6 || 6) - 1) % 6;
  const raw = bits.map((b, i) => ({ sum: b ? (i === mi ? 9 : 7) : (i === mi ? 6 : 8) }));
  const LY = window.LiuYao;
  const expectName = LY.arrange({ six: raw, monthGanZhi: '丙寅', dayGanZhi: '甲子' }).ben.name;
  ck('时间卦结果与独立复算一致', $('#tossTip').textContent.indexOf(expectName) >= 0, '页面=' + $('#tossTip').textContent + ' 期望=' + expectName);

  // ④ 单数起卦
  click(document.querySelector('.cast-btn[data-cast="num1"]'));
  await sleep(50);
  $('#num1Input').value = '268';
  click($('#btnCastNum1'));
  await sleep(200);
  ck('单数 268 → 雷泽归妹（时支修正后可能随当下时支变化，仅验证成卦+动爻数）', /成卦：/.test($('#tossTip').textContent), $('#tossTip').textContent);
  // 独立复算对账
  const h = Z[Lunar.fromDate(bj).getTimeZhi()];
  const raw2bits = XIAN[(268 + h) % 8 || 8].concat(XIAN[268 % 8 || 8]);
  const mi2 = (((268 + h) % 6 || 6) - 1) % 6;
  const raw2 = raw2bits.map((b, i) => ({ sum: b ? (i === mi2 ? 9 : 7) : (i === mi2 ? 6 : 8) }));
  const expect2 = LY.arrange({ six: raw2, monthGanZhi: '丙寅', dayGanZhi: '甲子' }).ben.name;
  ck('单数卦与独立复算一致', $('#tossTip').textContent.indexOf(expect2) >= 0, '页面=' + $('#tossTip').textContent + ' 期望=' + expect2);

  // ⑤ 双数起卦
  click(document.querySelector('.cast-btn[data-cast="num2"]'));
  await sleep(50);
  $('#num2a').value = '3'; $('#num2b').value = '268';
  click($('#btnCastNum2'));
  await sleep(200);
  ck('双数起卦成卦', /成卦：/.test($('#tossTip').textContent), $('#tossTip').textContent);

  // ⑥ 汉字起卦
  click(document.querySelector('.cast-btn[data-cast="hanzi"]'));
  await sleep(50);
  $('#hzInput').value = '风起于青萍之末';
  click($('#btnCastHanzi'));
  await sleep(200);
  ck('汉字起卦成卦', /成卦：/.test($('#tossTip').textContent), $('#tossTip').textContent);

  // ⑦ 卦名起卦：乾为天 → 天风姤
  click(document.querySelector('.cast-btn[data-cast="name"]'));
  await sleep(50);
  const guaA = $('#guaA'), guaB = $('#guaB');
  ck('卦名下拉各含 64 卦', guaA.options.length === 64 && guaB.options.length === 64, guaA.options.length + '/' + guaB.options.length);
  guaA.value = '乾为天'; guaB.value = '天风姤';
  click($('#btnCastName'));
  await sleep(200);
  ck('卦名起卦 乾为天之天风姤', /成卦：乾为天/.test($('#tossTip').textContent), $('#tossTip').textContent);
  ck('变卦为天风姤', /天风姤/.test($('#chartBox').textContent));

  // ⑧ 在线起卦（真请求或回落）
  click(document.querySelector('.cast-btn[data-cast="online"]'));
  await sleep(50);
  // 在线起卦已改为「一爻一请、六次成卦」（用户指定），故须连点六次
  for (let n = 1; n <= 6; n++) {
    click($('#btnCastOnline'));
    await sleep(9000);
  }
  ck('在线起卦六次成卦', /成卦：/.test($('#tossTip').textContent), $('#tossTip').textContent);
  ck('在线进度条记录六爻', $('#onlineLog') ? $('#onlineLog').children.length === 6 : true,
    $('#onlineLog') ? $('#onlineLog').children.length + ' 行' : '无进度条');
  ck('在线源说明展示', /random\.org|密码学随机/.test($('#onlineNote').textContent), $('#onlineNote').textContent);

  // 回归：重摇按钮与切模块
  click($('#divReset'));
  await sleep(100);
  ck('重摇清空成卦', !/成卦：/.test($('#tossTip').textContent));
  click($$('#modList .mod-card')[5] || $$('#modList .mod-card')[0]);
  await sleep(100);
  ck('切换模块后面板复位为电脑自动', $('.cast-btn.on') && $('.cast-btn.on').dataset.cast === 'auto');

  const realErrors = errors.filter(function (e) { return !/Could not load|not implemented|resource loading/i.test(e); });
  ck('无脚本错误', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  console.log('\n======== 冒烟汇总 ========');
  console.log('通过 ' + pass + '，失败 ' + fail);
  window.close();
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('冒烟崩溃：', e); try { window.close(); } catch (x) {} process.exit(2); });
