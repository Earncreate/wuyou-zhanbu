#!/usr/bin/env node
/** 发布包体检：jsdom 直接加载 dist/index.html，确认把它传到 Pages 上就能跑
 *  用法：node tmp/make_pages_dist.js https://后端域名 && node tmp/check_dist.js
 */
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('C:/Users/Yaojiawei/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('还没有 dist/，先跑 node tmp/make_pages_dist.js <后端地址>');
  process.exit(1);
}

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

const dom = new JSDOM(fs.readFileSync(path.join(DIST, 'index.html'), 'utf8'), {
  url: 'file://' + path.join(DIST, 'index.html').replace(/\\/g, '/'),
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.HTMLElement.prototype.scrollIntoView = function () { };
    window.scrollTo = function () { };   // jsdom 未实现，补桩免得误报
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
const $ = (s) => window.document.querySelector(s);
const $$ = (s) => window.document.querySelectorAll(s);
function click(el) { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); }

(async function main() {
  await new Promise((r) => window.addEventListener('load', r));
  await sleep(600);

  console.log('【1】静态资源是否齐全（相对路径引用）');
  const refs = [...window.document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src'))
    .concat([...window.document.querySelectorAll('link[href]')].map((l) => l.getAttribute('href')));
  ck('页面引用的资源全是相对路径', refs.length > 0 && refs.every((r) => !/^https?:|^\//.test(r)), refs.join(','));
  refs.forEach((r) => ck('存在 ' + r, fs.existsSync(path.join(DIST, r))));

  console.log('【2】功能是否照常');
  ck('引擎与配置已加载', !!(window.LiuYao && window.AppConfig && window.SymbolDict));
  ck('云同步客户端已加载', !!window.WYCloud);
  ck('模块列表已渲染', $$('#modList .mod-card').length >= 20, '实际 ' + $$('#modList .mod-card').length);
  const baked = /^window\.WYZB_API_BASE\s*=\s*'([^']*)';/m.exec(fs.readFileSync(path.join(DIST, 'libs', 'cloud.config.js'), 'utf8'));
  ck('后端地址已烧入配置', !!baked, baked ? '当前：' + (baked[1] || '（空=离线模式）') : '未找到');

  click($$('#modList .mod-card')[0]);
  await sleep(100);
  click($('#btnToss'));
  await sleep(6200);
  ck('摇卦成卦正常', /成卦：/.test($('#tossTip').textContent), $('#tossTip').textContent);
  ck('排盘已渲染', /本卦/.test($('#chartBox').textContent));

  console.log('【3】无脚本错误');
  ck('加载与操作全程无报错', errors.length === 0, errors.join(' | '));

  console.log('\n======== 发布包体检 ========');
  console.log('通过 ' + pass + '，失败 ' + fail);
  process.exit(fail ? 1 : 0);
})();
