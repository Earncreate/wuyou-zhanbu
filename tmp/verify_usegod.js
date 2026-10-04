/* 引擎级校验：确认用神生克图注入正确（不调 LLM，不烧 key） */
const CFG = require('../libs/config.js');
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');

const CASES = [
  { key: 'H1既济→loveM', six: [{sum:9},{sum:8},{sum:7},{sum:6},{sum:7},{sum:8}], mod: 'loveM', mg: '丙寅', dg: '甲子' },
  { key: 'H2困→illness', six: [{sum:6},{sum:7},{sum:8},{sum:9},{sum:7},{sum:8}], mod: 'illness', mg: '丙寅', dg: '甲子' },
  { key: 'H3蛊→career',  six: [{sum:8},{sum:9},{sum:7},{sum:6},{sum:8},{sum:7}], mod: 'career', mg: '丙寅', dg: '甲子' },
  { key: 'H4随→wealth',  six: [{sum:9},{sum:6},{sum:8},{sum:7},{sum:9},{sum:6}], mod: 'wealth', mg: '丙寅', dg: '甲子' }
];

CASES.forEach(c => {
  const chart = LY.arrange({ six: c.six, monthGanZhi: c.mg, dayGanZhi: c.dg });
  console.log('==== ' + c.key + ' ====');
  console.log('--- Stage1 锚点(节选) ---');
  const s1 = SYM.stage1Anchor(chart, c.mod);
  console.log(s1.split('\n').filter(l => l.indexOf('用神') >= 0 || l.indexOf('原神') >= 0 || l.indexOf('忌神') >= 0).join('\n'));
  console.log('--- Stage2 用神生克图(取 selectSymbols 内含段) ---');
  const sel = SYM.selectSymbols(chart, c.mod);
  console.log(sel.split('\n').filter(l => l.indexOf('用神生克图') >= 0 || l.indexOf('用神＝') >= 0 || l.indexOf('原神') >= 0 || l.indexOf('忌神') >= 0 || l.indexOf('生克展开') >= 0).join('\n'));
  const selG = SYM.selectSymbols(chart, 'general');
  console.log('--- 通用(general) 是否含"用神生克图":', selG.indexOf('用神生克图') >= 0 ? '含(应无!)' : '无(正确)');
  console.log('');
});
