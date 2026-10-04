// 验证"默认问法不再覆盖用户真实问题"修复
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('C:/Users/Yaojiawei/node_modules/jsdom');

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  >> ' + JSON.stringify(extra) : '')); }
}

// ---- ① 直接测 config.js 纯函数（libs 与 miniprogram 都应一致）----
function testCfg(CFG, label) {
  const askDef = CFG.ASK_DEFAULT.job;
  ck(label + ' askText 空->默认', CFG.askText('job', '') === askDef, CFG.askText('job', ''));
  ck(label + ' askText 实填->原样', CFG.askText('job', '专注测试还是AI') === '专注测试还是AI');
  ck(label + ' situationText 空+modId->默认', CFG.situationText('', 'job') === askDef, CFG.situationText('', 'job'));
  ck(label + ' situationText 实填->原样', CFG.situationText('我的心事', 'job') === '我的心事');
  ck(label + ' situationText 空无modId->兜底文案', CFG.situationText('', null).indexOf('未填写') >= 0);
}

const libs = require(path.resolve(__dirname, '../libs/config.js'));
testCfg(libs, 'libs');
const mp = require(path.resolve(__dirname, '../miniprogram/utils/config.js'));
testCfg(mp, 'miniprogram');

ck('libs 与 miniprogram 的 ASK_DEFAULT.job 一致', libs.ASK_DEFAULT.job === mp.ASK_DEFAULT.job);

// ---- ② jsdom 加载真实 index.html，模拟进入 job 模块，检查 textarea 不再预填默认 ----
const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
global.window = window; global.document = window.document;
// 注入最小依赖桩，让 IIFE 能跑（引擎等外部脚本不加载，只测 UI 文本逻辑）
window.Lunar = undefined;
try {
  // 直接执行 index.html 内联脚本会触发外部依赖报错，这里改为只静态校验关键行
  const hasOldInjection = /esc\(state\.text \|\| CFG\.ASK_DEFAULT\[state\.moduleId\]/.test(html);
  ck('index.html 已移除「默认问法注入 textarea value」', !hasOldInjection);
  const hasNewEmpty = /esc\(state\.text \|\| ''\)/.test(html) && !/CFG\.ASK_DEFAULT\[state\.moduleId\]/.test(html.split('placeholder=')[0].split('askText')[1] || '');
  ck('index.html textarea value 改为 state.text||\'\'（且不再注入默认）', hasNewEmpty);
  ck('index.html 问事展示传入 modId(还原分支)', /situationText\(state\.text, state\.moduleId\)/.test(html));
} catch (e) {
  ck('jsdom 静态校验未抛错', false, e.message);
}

console.log('\n  汇总：通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
