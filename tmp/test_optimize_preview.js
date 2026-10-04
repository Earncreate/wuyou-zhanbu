// 优化后预演：验证 (1)loveM 不再塌通用 (2)通用模块臃肿下降 (3)Stage1 已锚定用神
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');
const CFG = require('../libs/config.js');

const GUAS = [
  { key: 'H1(感情·水火既济)', six: [9,8,7,6,7,8] },
  { key: 'H2(生意·泽水困)', six: [6,7,8,9,7,8] },
  { key: 'H3(升职·山风蛊)', six: [8,9,7,6,8,7] },
  { key: 'H4(病·泽雷随)', six: [9,6,8,7,9,6] }
];
const MODS = ['loveM', 'wealth', 'career', 'illness', 'general'];

// 优化前确定性基线（来自上次 real 脚本 selectSymbols 长度）
const BASE = {
  'H1(感情·水火既济)|loveM': 1125, 'H1(感情·水火既济)|general': 1125,
  'H2(生意·泽水困)|wealth': 1332, 'H2(生意·泽水困)|general': 1116,
  'H3(升职·山风蛊)|career': 1184, 'H3(升职·山风蛊)|general': 1057,
  'H4(病·泽雷随)|illness': 1481, 'H4(病·泽雷随)|general': 1089
};

console.log('=== 优化后 selectSymbols 注入对比（含模块章法/伏藏标记）===');
GUAS.forEach(function (g) {
  const c = LY.arrange({ six: g.six.map(s => ({ sum: s })), monthGanZhi: '丙寅', dayGanZhi: '甲子' });
  console.log('\n[' + g.key + '] 卦名=' + c.ben.name);
  MODS.forEach(function (m) {
    const inj = SYM.selectSymbols(c, m);
    const s1 = SYM.stage1Anchor(c, m);
    const hasRule = inj.includes('模块章法');
    const hasFu = inj.includes('伏藏') || s1.includes('伏藏');
    const k = g.key + '|' + m;
    const base = BASE[k];
    const delta = base != null ? (inj.length - base) : '-';
    console.log('  ' + m.padEnd(8) + ' 注入=' + String(inj.length).padStart(4) +
      ' 章法=' + (hasRule ? 'Y' : 'N') + ' 伏藏=' + (hasFu ? 'Y' : 'N') +
      ' Stage1锚=' + String(s1.length).padStart(4) +
      ' 基线差=' + delta);
  });
});

console.log('\n=== 关键结论核验 ===');
// H1 loveM vs general 是否仍逐字相同
const c1 = LY.arrange({ six: GUAS[0].six.map(s => ({ sum: s })), monthGanZhi: '丙寅', dayGanZhi: '甲子' });
const loveM1 = SYM.selectSymbols(c1, 'loveM');
const gen1 = SYM.selectSymbols(c1, 'general');
console.log('H1 loveM 与 general 仍相同？', loveM1 === gen1 ? '是(塌通用未解)' : '否(已解，内容不同)');
console.log('H1 loveM 独有章法关键词:',
  loveM1.includes('男问感情') ? '男问感情章法✓' : '缺失',
  gen1.includes('通用问事章法') ? '通用章法✓' : '缺失');
console.log('H1 loveM 伏神提示?', loveM1.includes('伏藏') ? '有(用神不上卦已补)' : '无');
