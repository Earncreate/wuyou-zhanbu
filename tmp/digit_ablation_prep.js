/* 数字下沉消融 · 素材准备（干跑，不烧 key）
 *
 * 检验命题：把结构规则（爻层次／变爻旁爻／合冲刑害次序）下沉为**数字生成规则**之后，
 *          模型是否真的绕不开这些数字。
 *
 * 2×2 消融设计（缺一格，据实说明）：
 *            有说明文字        无说明文字
 *   数字已过滤  ON（生产）        BARE（裸数字，只给数）
 *   数字未过滤  ——（缺）          OFF（原始旺衰分，无说明）
 *
 *   ON  vs BARE → 隔离「说明文字」这一个变量
 *   BARE vs OFF  → 隔离「数字是否过滤」这一个变量 ← 本实验的主命题
 *
 * 素材筛选标准：同一卦例在 yaoLayer 开/关下，喂给模型的数字必须**真的不同**，
 *   否则两组无差异，实验作废（历史教训：轴锁消融曾因对照组仍吃契约文本而全等）。
 *   按命中类型配额收集，保证四类结构规则都有素材：
 *     A 静爻无权（忌神克用之力按零）
 *     B 变爻旁爻（作用写进用神分数）
 *     C 值日月之静爻（有力无权）
 *     D 合冲刑害次序（取唯一关系）
 */
const fs = require('fs');
const path = require('path');
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');
const CFG = require('../libs/config.js');

const MONTHS = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
const DAYS = ['甲子', '戊辰', '甲戌', '丙子', '甲申', '庚辰', '甲午', '丁酉', '甲辰', '壬子', '甲寅', '癸酉'];
const LIUQIN = ['兄弟', '子孙', '妻财', '父母', '官鬼'];
const QUIZ = {
  loveM: '这段感情能成吗', loveF: '他什么时候会出现', wealth: '这笔生意能赚吗',
  career: '今年能升职吗', illness: '我这个病严重吗', study: '这次考试能过吗',
  child: '什么时候能怀上孩子', lost: '丢的东西能找回来吗', job: '这个offer能拿到吗'
};
const PER_KIND = 3;   // 每类 3 个场景，共 12
const PER_GUA = 1;    // 每卦最多 1 个场景，保证卦象多样性

function netOf(chart, lq) {
  LY.setAblation({ relationRules: true, yaoLayer: true });
  const on = LY.getUseGodRelation(chart, lq);
  LY.setAblation({ relationRules: true, yaoLayer: false });
  const off = LY.getUseGodRelation(chart, lq);
  LY.setAblation({ relationRules: true, yaoLayer: true });
  if (!on || !off) return null;
  const grab = (r) => {
    const v = (r.verdict || []).join('；');
    const m = v.match(/阵营净力[^＝]*＝\s*(-?\d+)/);
    return {
      net: m ? parseInt(m[1], 10) : null,
      ys: r.ysScore, jsEff: r.jsEff, yuanEff: r.yuanEff, chouEff: r.chouEff,
      jsRaw: r.jsScore, yuanRaw: r.yuanScore, chouRaw: r.chouScore,
      verdict: v, bianPang: r.bianPangDelta, rel: r.relOrder ? r.relOrder.rel : null
    };
  };
  return { on: grab(on), off: grab(off) };
}

// 命中类型判定（顺序即优先级：值日月之静爻是"有力无权"的特例，须先于"无权"判定，
// 否则 C 类会被 A 类吞掉，四类素材无法均衡）
//
// 注意 D 类（合冲刑害次序）：核查引擎实现后确认——该规则**只改变说明文字，不改变任何数字**
// （relOrder 仅写 out.relOrder 与 verdict 说明，effForce 不读它）。故它无法进入本实验的
// 「数字 vs 无数字」2×2 设计，只能做「有文字 vs 无文字」那一维，已单列在 layerWords 消融中。
// 硬断言：kindOf 不得返回 'D'，否则说明引擎侧已改动，素材前提需重估。
function kindOf(d) {
  if (d.on.bianPang) return 'B';
  if (/层次转换/.test(d.on.verdict)) return 'C';
  if (d.on.jsEff !== d.on.jsRaw || d.on.yuanEff !== d.on.yuanRaw) return 'A';
  return null;
}

function collect() {
  // 第一遍：全量收集所有「数字真的不同」的候选
  const cands = [];
  for (let id = 0; id < 64; id++) {
    const up = Math.floor(id / 8), lo = id % 8;
    const yin = [lo & 1, (lo >> 1) & 1, (lo >> 2) & 1, up & 1, (up >> 1) & 1, (up >> 2) & 1];
    const variants = [
      yin.map((v, i) => (i === 2 || i === 4 ? (v ? 9 : 6) : (v ? 7 : 8))),
      yin.map((v, i) => (i === 1 || i === 5 ? (v ? 9 : 6) : (v ? 7 : 8))),
      yin.map((v, i) => (i === 0 || i === 3 ? (v ? 9 : 6) : (v ? 7 : 8))),
      yin.map((v, i) => (i === 2 || i === 4 ? (v ? 7 : 8) : (v ? 9 : 6))),
      yin.map((v) => (v ? 7 : 8))
    ];
    for (const six of variants) for (const mg of MONTHS) for (const dg of DAYS) {
      const c = makeChart(six, mg, dg);
      if (!c) continue;
      for (const lq of LIUQIN) {
        // 模块：任何用神能落到该六亲的模块都算，按顺序取第一个可用（保证模块与卦象分散）
        const modId = Object.keys(QUIZ).find((m) => (SYM.resolveUseGod(m, QUIZ[m], c) || {}).useLq === lq);
        if (!modId) continue;
        const d = netOf(c, lq);
        if (!d || d.on.net === null || d.off.net === null) continue;
        const diff = d.on.jsEff !== d.off.jsEff || d.on.yuanEff !== d.off.yuanEff
          || d.on.chouEff !== d.off.chouEff || d.on.ys !== d.off.ys;
        if (!diff) continue;
        const k = kindOf(d);
        if (!k) continue;
        const a = d.on.net, b = d.off.net;
        const dirFlip = ((a > 0) !== (b > 0) || (a < 0) !== (b < 0)) ? 1 : 0;
        cands.push({ chart: c, lq: lq, modId: modId, kind: k, d: d, sixRaw: six.slice(),
          month: mg, day: dg, dirFlip: dirFlip, gap: Math.abs(a - b),
          // 净力越极端越能检验采信：net=0 属"势均力敌"，两组都吉凶难判，区分度低
          strength: Math.min(Math.abs(a), Math.abs(b)),
          gua: c.ben.name });
      }
    }
  }

  // 候选排序：先方向翻转，再净力极端者（区分度最高），最后净力差大者
  cands.sort((x, y) => (y.dirFlip - x.dirFlip) || (y.strength - x.strength) || (y.gap - x.gap));
  const perGua = {}, perMod = {}, perKind = {};
  const pick = (f) => {
    const out = [];
    for (const s of cands) {
      if (out.length >= f.total) break;
      if ((perKind[s.kind] || 0) >= f.kindCap) continue;
      if ((perGua[s.gua] || 0) >= 1) continue;
      if ((perMod[s.modId] || 0) >= f.modCap) continue;
      perKind[s.kind] = (perKind[s.kind] || 0) + 1;
      perGua[s.gua] = (perGua[s.gua] || 0) + 1;
      perMod[s.modId] = (perMod[s.modId] || 0) + 1;
      out.push(s);
    }
    return out;
  };
  const first = pick({ total: 8, kindCap: 2, modCap: 1 });   // 每类 2 个、每模块 1 个 → 模块最散
  const second = pick({ total: 18, kindCap: 5, modCap: 2 });  // 再补，模块上限放宽
  const third = pick({ total: 24, kindCap: 6, modCap: 3 });
  return first.concat(second, third);
}

function makeChart(six, mg, dg) {
  try { return LY.arrange({ six: six.map((x) => ({ sum: x })), monthGanZhi: '丙' + mg, dayGanZhi: dg }); }
  catch (e) { return null; }
}

const scenes = collect();
console.log('数字下沉消融素材：命中 ' + scenes.length + ' 个场景');
['A', 'B', 'C'].forEach((k) => {
  const n = scenes.filter((s) => s.kind === k).length;
  const nm = { A: 'A 静爻无权（忌/原神克用生用之力按零）', B: 'B 变爻旁爻（作用写进用神分数）',
    C: 'C 值日月之静爻（有力无权）' }[k];
  console.log('　' + nm + '：' + n);
});
const modDist = {};
scenes.forEach((s) => { modDist[s.modId] = (modDist[s.modId] || 0) + 1; });
console.log('　模块分布：' + Object.keys(modDist).map((m) => m + '×' + modDist[m]).join('、'));
console.log('　（合冲刑害次序 D 类不入本实验：核查确认它只改说明文字、不改数字，见 kindOf 注释）');

let flip = 0, bigDiff = 0;
scenes.forEach((s) => {
  const a = s.d.on.net, b = s.d.off.net;
  if ((a > 0) !== (b > 0) || (a < 0) !== (b < 0)) flip++;
  if (Math.abs(a - b) >= 2) bigDiff++;
});
console.log('\n=== 数字差异强度（决定这批素材有没有实验价值）===');
console.log('　净力方向翻转：' + flip + '/' + scenes.length);
console.log('　净力差值 ≥2：' + bigDiff + '/' + scenes.length);
console.log('　（方向翻转者，模型若采信数字，两组断语必成对立，最能暴露"绕开"与否）');

console.log('\n=== 样例（数字开/关对照）===');
scenes.slice(0, 4).forEach((s) => {
  console.log('  【' + s.kind + '】' + s.gua + ' / 用神' + s.lq + '（' + s.modId + '）'
    + ' 月' + s.month + '日' + s.day + (s.dirFlip ? '  ★方向翻转' : ''));
  console.log('    开：用神' + s.d.on.ys + ' 忌' + s.d.on.jsEff + ' 原' + s.d.on.yuanEff
    + ' 仇' + s.d.on.chouEff + ' → net ' + s.d.on.net);
  console.log('    关：用神' + s.d.off.ys + ' 忌' + s.d.off.jsEff + ' 原' + s.d.off.yuanEff
    + ' 仇' + s.d.off.chouEff + ' → net ' + s.d.off.net);
  const bp = (s.d.on.verdict.match(/变爻旁爻[^；]*/) || [''])[0];
  const ly = (s.d.on.verdict.match(/爻层次[^；]*/) || [''])[0];
  console.log('    痕迹：' + (bp || ly || '（净力差来自旁爻叠加）'));
});

// 产出素材
const payload = scenes.map((s) => {
  const chart = s.chart;
  return {
    gua: chart.ben.name, month: s.month, day: s.day, sixRaw: s.sixRaw,
    useLq: s.lq, mod: s.modId, ask: QUIZ[s.modId], kind: s.kind,
    on: s.d.on, off: s.d.off,
    six: chart.ben.yaos.map((y) => ({
      pos: y.posName, gz: y.ganzhi, lq: y.liuqin, wx: y.wuxing,
      mov: !!y.isMoving, shi: !!y.isShi, kong: !!y.isKong, yuepo: !!y.isYuePo,
      score: y.wang ? y.wang.score : null, level: y.wang ? y.wang.level : null
    }))
  };
});
const out = path.join(__dirname, 'digit_ablation_payload.json');
fs.writeFileSync(out, JSON.stringify(payload, null, 1), 'utf8');
console.log('\n素材已落：' + out + '（' + payload.length + ' 场景）');
console.log('真跑命令：WY_BASE=https://api.deepseek.com/v1 WY_MODEL=deepseek-chat WY_KEY=sk-xxx node tmp/run_digit_ablation.js');
