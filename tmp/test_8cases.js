/* 受控实验：4 专属模块 + 通用模块 × 4 问（同卦配对）
 * 目的：导出"词表选择器实际注入给模型"的片段，作为客观数据。
 * 说明：本机无 LLM key，最终"结论"由专家按注入提示词模拟产出（另文）。此处只产出确定性事实。
 */
const LY = require('../libs/liuyao.js');
const CFG = require('../libs/config.js');
const SYM = require('../libs/symbol_dict.js');

// 固定起卦参数（可复现）
const MONTH = '丙寅';
const DAY = '甲子';

// 4 卦（六爻自初到上）。9=老阳动, 6=老阴动, 7/8=静
const HEX = {
  H1: [9, 8, 7, 6, 7, 8],
  H2: [6, 7, 8, 9, 7, 8],
  H3: [8, 9, 7, 6, 8, 7],
  H4: [9, 6, 8, 7, 9, 6]
};

// 4 问 + 对应专属模块
const CASES = [
  { key: 'H1', mod: 'loveM',  q: '最近和对象总吵架，想问这段感情还能不能走下去' },
  { key: 'H2', mod: 'wealth', q: '想问最近这个小生意能不能赚到钱' },
  { key: 'H3', mod: 'career', q: '想知道今年我在单位能不能升职' },
  { key: 'H4', mod: 'illness', q: '最近老咳嗽睡不好，想问这病什么时候能好' }
];

function yaoInfo(y) {
  return {
    pos: y.pos, zhi: y.zhi, lq: y.liuqin,
    shi: !!y.isShi, ying: !!y.isYing, mv: !!y.isMoving,
    kong: !!y.isKong, po: !!y.isYuePo,
    score: y.wang ? y.wang.score : null,
    marks: (y.wang && y.wang.marks) ? y.wang.marks : [],
    hua: (y.hua && y.hua.flags) ? y.hua.flags : []
  };
}

function useCandidate(chart, modId) {
  const useLq = SYM.MOD_USE ? SYM.MOD_USE[modId] : null;
  if (!useLq) return null;
  return chart.ben.yaos.filter(y => y.liuqin === useLq).map(yaoInfo);
}

function dumpCase(c, isGeneral) {
  const modId = isGeneral ? 'general' : c.mod;
  const chart = LY.arrange({ six: HEX[c.key].map(s => ({ sum: s })), monthGanZhi: MONTH, dayGanZhi: DAY });
  const stage2sys = CFG.buildStage2Messages(modId, c.q, chart, '（卦象总断占位，选择器不依赖它）')[0].content;
  const stage1sys = CFG.buildStage1Messages(modId, c.q, chart)[0].content;
  const line = [
    '============================================================',
    `[${isGeneral ? '通用' : c.mod}] 问="${c.q}"  卦=${chart.ben.name}  动爻位=${JSON.stringify(chart.moving)}`,
    '本卦六爻(初→上): ' + chart.ben.yaos.map(y => `${y.posName}${y.zhi}/${y.liuqin}${y.isMoving ? '动' : ''}${y.isKong ? '空' : ''}${y.isYuePo ? '破' : ''}`).join('  '),
    '',
    '--- 用神候选(模块=' + modId + ') ---',
    useCandidate(chart, modId) ? JSON.stringify(useCandidate(chart, modId), null, 0) : '(通用模块无固定用神，依问取)',
    '',
    '--- Stage1 system 是否含"联想约束·实况选取"？ ---',
    stage1sys.includes('联想约束·实况选取') ? '是(异常：选择器被注入了总断)' : '否(正确：选择器只在 Stage2)',
    '',
    '--- Stage2 注入的【联想约束·实况选取】全文 ---',
    stage2sys.includes('联想约束·实况选取') ? stage2sys.split('联想约束·实况选取')[1].split('\n# 输出流程')[0] : '(无注入)',
    ''
  ].join('\n');
  return line;
}

let out = '';
out += '实验参数：月建=' + MONTH + ' 日辰=' + DAY + '（甲子旬戌亥空）\n';
out += '配对原则：每问同一卦，分别跑专属模块与通用模块，唯一变量=moduleId。\n\n';
for (const c of CASES) {
  out += dumpCase(c, false) + '\n';
  out += dumpCase(c, true) + '\n';
}
process.stdout.write(out);
require('fs').writeFileSync(__dirname + '/8cases_report.txt', out, 'utf-8');
console.log('\n[OK] 已写 tmp/8cases_report.txt');
