// 纯离线扫描（不调用 LLM）：
//  1) 阵营净力 net 的分布，用于给「净力分档」选阈值
//  2) 若把合冲刑害「唯一关系」按条件权值下沉，net 会改动多少例、方向翻转多少例
//  3) 用神自身分数 vs 净力的量级落差，看是否存在「信号被量级淹没」
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');
const CFG = require('../libs/config.js');

const BRANCH = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const MONTHS = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
const DAYS = ['甲子', '丙寅', '戊辰', '庚午', '壬申', '甲午', '丙申', '戊戌', '庚子', '壬寅'];
const LIUQIN = ['兄弟', '子孙', '妻财', '父母', '官鬼'];
const QUIZ = {
  general: '这件事前景如何', wealth: '今年财运如何', career: '这次面试能过吗',
  loveM: '这段感情能成吗', health: '这个病什么时候好', lawsuit: '这场官司能赢吗',
  exam: '这次考试能过吗', travel: '这次出行顺利吗', lost: '丢的东西能找回吗',
  house: '这套房子能买吗', business: '这笔生意能赚吗'
};

function makeChart(six, mg, dg) {
  try { return LY.arrange({ six: six.map((s) => ({ sum: s })), monthGanZhi: '丙' + mg, dayGanZhi: dg }); }
  catch (e) { return null; }
}
function netOf(c, lq) {
  LY.applyInterYao(c, lq);   // 用神须先传入，爻际量化才生效（装卦阶段不传用神）
  const r = LY.getUseGodRelation(c, lq);
  if (!r) return null;
  // net 已作为字段透出（此前只写进 verdict 文本，调用方只能正则抠字）
  return { net: r.net, mode: r.netMode, ys: r.ysScore, js: r.jsEff, yuan: r.yuanEff, chou: r.chouEff,
    jsRaw: r.jsScore, yuanRaw: r.yuanScore, chouRaw: r.chouScore, relOrder: r.relOrder };
}

// 条件权值函数（拟下沉用；与 bianPangApply 已有逻辑同构：旺则起、衰则散）
function relWeight(rel, rawDir, forceScore) {
  if (rel === '合') return forceScore >= 1 ? 1 : -1;          // 合起 / 合绊
  if (rel === '冲') return forceScore >= 1 ? 1 : -2;          // 冲起 / 冲散
  if (rel === '刑') return -1;
  if (rel === '害') return -1;
  return 0;                                                   // 普通生克维持原口径
}

const nets = [];
let relHit = 0, relFlip = 0, relDelta = 0;
const deltaHist = {};
const gapHist = [];

for (let id = 0; id < 64; id++) {
  const up = Math.floor(id / 8), lo = id % 8;
  const yin = [lo & 1, (lo >> 1) & 1, (lo >> 2) & 1, up & 1, (up >> 1) & 1, (up >> 2) & 1];
  const variants = [
    yin.map((v, i) => (i === 2 || i === 4 ? (v ? 9 : 6) : (v ? 7 : 8))),
    yin.map((v, i) => (i === 1 || i === 5 ? (v ? 9 : 6) : (v ? 7 : 8))),
    yin.map((v) => (v ? 7 : 8))
  ];
  for (const six of variants) for (const mg of MONTHS) for (const dg of DAYS.slice(0, 4)) {
    const c = makeChart(six, mg, dg);
    if (!c) continue;
    for (const lq of LIUQIN) {
      const d = netOf(c, lq);
      if (!d || d.net === null || d.net === undefined) continue;
      nets.push(d.net);
      gapHist.push(Math.abs(d.net) - Math.abs(d.ys));
      // 合冲刑害下沉的影响面：忌神↔用神之间若存在合/冲/刑/害，权值会改净力
      if (d.relOrder && ['合', '冲', '刑', '害'].indexOf(d.relOrder.rel) >= 0) {
        relHit++;
        const w = relWeight(d.relOrder.rel, d.relOrder.rawDir, d.js);
        // 忌神对用神的作用：忌神克用为损，故负值；合/刑/害按其性质调整
        const adj = -w;
        const net2 = d.net - d.js + d.js + adj; // 净力中忌神项由 -js 变为 -(js + w)
        const net2v = d.net - w;
        if (net2v !== d.net) { relDelta++; deltaHist[net2v - d.net] = (deltaHist[net2v - d.net] || 0) + 1; }
        if ((net2v > 0) !== (d.net > 0)) relFlip++;
      }
    }
  }
}

nets.sort((a, b) => a - b);
function pct(p) { return nets[Math.floor(nets.length * p)]; }
console.log('=== 1. 阵营净力 net 分布（样本 ' + nets.length + '）===');
console.log('  最小 ' + nets[0] + '　5% ' + pct(0.05) + '　25% ' + pct(0.25) + '　中位 ' + pct(0.5)
  + '　75% ' + pct(0.75) + '　95% ' + pct(0.95) + '　最大 ' + nets[nets.length - 1]);
const near0 = nets.filter((x) => x === 0).length;
const abs12 = nets.filter((x) => Math.abs(x) <= 2).length;
const abs34 = nets.filter((x) => Math.abs(x) >= 3 && Math.abs(x) <= 5).length;
const abs6p = nets.filter((x) => Math.abs(x) >= 6).length;
console.log('  |net|=0（真两可）：' + near0 + '　1~2（近两可）：' + (abs12 - near0)
  + '　3~5（有倾向）：' + abs34 + '　≥6（悬殊）：' + abs6p);

console.log('\n=== 2. 合冲刑害下沉的影响面 ===');
console.log('  忌神↔用神间存在合/冲/刑/害的卦例：' + relHit + ' / ' + nets.length
  + '（' + (100 * relHit / nets.length).toFixed(1) + '%）');
console.log('  其中净力数值被改动的：' + relDelta + '　方向翻转的：' + relFlip);
console.log('  权值分布：' + JSON.stringify(deltaHist));

console.log('\n=== 3. 量级落差 |net| − |用神自身分| ===');
const g = gapHist.slice().sort((a, b) => a - b);
console.log('  中位 ' + g[Math.floor(g.length / 2)] + '　最大 ' + g[g.length - 1] + '　最小 ' + g[0]);
const big = gapHist.filter((x) => x >= 4).length;
console.log('  落差 ≥4（净力被他爻量级主导，用神自身分占比很小）的：' + big
  + '（' + (100 * big / gapHist.length).toFixed(1) + '%）——这类最容易让模型丢开净力去抓单爻信号');

LY.setAblation({ relationRules: true, yaoLayer: true, layerWords: true });
