'use strict';
// 诊断：8 个非 MOD_USE 模块的用神 / 原神·忌神·仇神 / 力量解读现状
const LY = require('../libs/liuyao.js');
const CFG = require('../libs/config.js');
const SYM = require('../libs/symbol_dict.js');

const TARGETS = ['general','fweek','fyear','misc','num','person','sport','travel'];
const MOD_USE = SYM.MOD_USE || {};

// 取两个不同卦宫的样例卦，观察原/忌/仇是否随宫变化
function mk(chartSeed) {
  const six = [];
  for (let i = 0; i < 6; i++) six.push({ sum: chartSeed[i] });
  return LY.arrange({ six: six, monthGanZhi: '丙寅', dayGanZhi: '甲子' });
}
// 金宫（乾/兑）：用神乾为天
const gJin = mk([7,7,7,7,7,7]);
// 水宫（坎）：坎为水
const gShui = mk([6,6,6,6,6,6]);

function diagOne(modId, chart, label) {
  const mod = CFG.MODULES[modId];
  if (!mod) return console.log('  [缺失模块] ' + modId);
  const useLq = mod.yongshen;
  const inUseTable = !!MOD_USE[modId];
  const el = chart.ben.info.element;
  const yj = LY.liuqinYuanJi(el, useLq);
  // 力量比较行
  const mr = CFG.MODULES; // 仅占位，真正用 modRoles
  let powerLine = '(无)';
  try {
    const txt = CFG.chartText(chart, mod);
    const m = txt.match(/比较（用神[^）]*）[^\n]*/);
    powerLine = m ? m[0].slice(0, 60) + '…' : '(chartText 未产出比较行)';
  } catch (e) { powerLine = '(chartText 异常: ' + e.message + ')'; }
  console.log('  [' + modId + '] 宫=' + el + ' 用神(inline)=' + useLq +
    ' 在MOD_USE表=' + inUseTable +
    ' → 原=' + (yj && yj.yuan) + ' 忌=' + (yj && yj.ji) + ' 仇=' + (yj && yj.chou) +
    ' | 力量: ' + powerLine);
}

console.log('========== 金宫样例（' + gJin.ben.info.name + '，宫=' + gJin.ben.info.element + '）==========');
TARGETS.forEach(id => diagOne(id, gJin, '金'));
console.log('');
console.log('========== 水宫样例（' + gShui.ben.info.name + '，宫=' + gShui.ben.info.element + '）==========');
TARGETS.forEach(id => diagOne(id, gShui, '水'));
console.log('');
console.log('===== 结论要点 =====');
console.log('1) 8 模块 inline 用神是否逐宫变化：若原/忌/仇随宫变，说明已接入 modRoles 逐宫实算；');
console.log('2) 在MOD_USE表= false 说明用神来自占位字面量，需评估是否应改为“问事取用/世爻为纲”。');
