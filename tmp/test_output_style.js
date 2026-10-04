#!/usr/bin/env node
/** 输出界面国风渲染测试：加载真实 index.html，验证 renderJyDoc 渲染与转义安全 */
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('C:/Users/Yaojiawei/node_modules/jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
vc.on('error', (m) => errors.push('console.error: ' + m));

const dom = new JSDOM(html, {
  url: 'file://' + path.join(root, 'index.html').replace(/\\/g, '/'),
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(window) {
    const mem = {};
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } } });
    window.fetch = () => new Promise(() => {}); // 不触发真实网络
    window.crypto = require('crypto').webcrypto;
  }
});
const { window } = dom;

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '　' + extra : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SAMPLE = [
  '你问"财运/生意"——财有其象，但得之费力：可以小步试水，不宜重仓投入。',
  '',
  '【一、吉凶判断】',
  '妻财（初爻丑土）强于忌神兄弟，吉象；但用神处"休"地、被金局泄气，属"有气待引"，非大财。',
  '原神子孙（五爻巳火）月囚、长生入绝，财源弱则纵得亦难长久。',
  '',
  '## 核心判断',
  '- 财能不能得：可得，但费力、量有限',
  '- 财源（客户/现金流）：弱，最大隐忧',
  '- 我方（世爻）：极弱但非全无',
  '',
  '应期参考',
  '1. 酉日（起卦当日）：冲空则实，宜即日起做小规模验证。',
  '2. 子日（约第 3 天）：丑与子六合，第一笔实际回款或关键进展。',
  '3. 巳、午日（约第 8–9 天）：火生土，财爻得气之期，可再评估是否加码。',
  '',
  '理性提示：六爻是决策辅助，而非宿命判决。本卦示"财有其象而得之费力"，成事在于是否小步验证、守规避争，而非卦象替你定输赢。'
].join('\n');

const XSS = '正常的结论文字 <img src=x onerror="alert(1)"> 以及 **加粗** 与 <script>bad()</script>';

(async function main() {
  await sleep(500);
  ck('index.html 解析无脚本错误', errors.length === 0, errors.slice(0, 3).join(' | '));
  ck('renderJyDoc 已暴露', typeof window.renderJyDoc === 'function');

  const h = window.renderJyDoc(SAMPLE);
  ck('首段渲染为结论框', /jy-verdict/.test(h) && /卦象结论/.test(h));
  ck('一句话原文进入结论框', h.indexOf('可以小步试水') >= 0);
  ck('【一、…】渲染为金线标题', /jy-h2/.test(h) && h.indexOf('吉凶判断') >= 0);
  ck('## 标题渲染为 jy-h2', h.indexOf('核心判断') >= 0 && /jy-h2/.test(h));
  ck('无序列表渲染为卡片网格(ul.jy-ul)', /<ul class="jy-ul">/.test(h) && (h.match(/<li>/g) || []).length >= 3);
  ck('编号行动渲染为 jy-todo 卡', /<ol class="jy-todo">/.test(h));
  ck('理性提示渲染为便签', /jy-note/.test(h));

  const x = window.renderJyDoc(XSS);
  ck('XSS：<img> 被转义', x.indexOf('&lt;img') >= 0 && x.indexOf('<img') < 0);
  ck('XSS：<script> 被转义', x.indexOf('&lt;script') >= 0 && x.indexOf('<script') < 0);
  ck('加粗 ** 生效', /<b>加粗<\/b>/.test(x));

  // 空输入健壮性
  ck('空输入返回空串', window.renderJyDoc('') === '' && window.renderJyDoc(null) === '');

  console.log('\n======== 输出样式测试汇总 ========');
  console.log('通过 ' + pass + '，失败 ' + fail);
  window.close();
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('测试崩溃：', e); try { window.close(); } catch (x) {} process.exit(2); });
