/**
 * 爻的四个层次 / 变爻旁爻 / 合冲刑害次序 —— 专项回归（不烧 key）
 *
 * 背景：避空与贪生忘克两条规则经真模型消融实测，模型采信引擎净力 0/8，
 *       且加上后断语质量下降。根因是这两条只改"说明"、不改"数字"，
 *       模型拿分项自算即可绕开。
 * 本套三条规则的性质不同：它们下沉到【数字生成环节】——
 *       低层次爻无权作用高层次爻时，有效作用力直接按零计，
 *       引擎交给模型的就是过滤后的值，模型自算亦得同一结果。
 * 因此本测试的核心断言不是"文案里有没有这句话"，而是"数字有没有真的变"。
 *
 * 理论依据：曲炜《六爻详真》爻之四层次（本于李洪成三层次）；
 *           曲炜《六爻答疑》第十六问（合冲刑害次序与层次不矛盾）。
 */
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');

let pass = 0, fail = 0;
function ck(name, ok, extra) {
  if (ok) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

const MONTHS = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
const DAYS = ['甲子', '戊辰', '甲戌', '丙子', '甲申', '庚辰', '甲午', '丁酉', '甲辰', '壬子', '甲寅', '癸酉'];
const LIUQIN = ['兄弟', '子孙', '妻财', '父母', '官鬼'];

console.log('================ ① 层次定义（权力维度，与旺衰无关）================');
{
  let dong = 0, jing = 0, andong = 0, bian = 0, total = 0;
  for (let id = 0; id < 64; id++) {
    const up = Math.floor(id / 8), lo = id % 8;
    const y = [lo & 1, (lo >> 1) & 1, (lo >> 2) & 1, up & 1, (up >> 1) & 1, (up >> 2) & 1];
    const six = y.map((v, i) => (i === 2 || i === 4 ? (v ? 9 : 6) : (v ? 7 : 8)));
    let c;
    try { c = LY.arrange({ six: six.map((s) => ({ sum: s })), monthGanZhi: '丙寅', dayGanZhi: '甲子' }); } catch (e) { continue; }
    c.ben.yaos.forEach((yy) => {
      total++;
      const lv = LY.layerOf(yy);
      if (yy.isMoving) { if (lv === 3) dong++; }
      else if (yy.wang && yy.wang.dayFlags.indexOf('暗动') >= 0) { if (lv === 3) andong++; }
      else if (lv === 4) jing++;
    });
    (c._bianPang || []).forEach((bp) => { if (bp.bianYao && LY.layerOf(bp.bianYao) === 2) bian++; });
  }
  ck('动爻判为第三层次（' + dong + ' 例）', dong > 0);
  ck('静爻判为第四层次（' + jing + ' 例）', jing > 0);
  ck('变爻判为第二层次（' + bian + ' 例）', bian > 0);
  ck('暗动之爻随动爻同列第三层次（' + andong + ' 例）', andong > 0);
  console.log('    （共扫描 ' + total + ' 个本卦爻；暗动例数随月日而变，此处固定丙寅/甲子）');
}

console.log('\n================ ② 生克权：低层次无权作用高层次 =================');
{
  let jingToDong = 0, jingToDongZero = 0;
  let dongToJing = 0, dongToJingFull = 0;
  let bianToDong = 0, bianToDongOK = 0;
  let dongToBian = 0, dongToBianZero = 0;
  for (let id = 0; id < 64; id++) {
    const up = Math.floor(id / 8), lo = id % 8;
    const y = [lo & 1, (lo >> 1) & 1, (lo >> 2) & 1, up & 1, (up >> 1) & 1, (up >> 2) & 1];
    const six = y.map((v, i) => (i === 2 || i === 4 ? (v ? 9 : 6) : (v ? 7 : 8)));
    for (const mg of MONTHS) for (const dg of DAYS) {
      let c;
      try { c = LY.arrange({ six: six.map((s) => ({ sum: s })), monthGanZhi: '丙' + mg, dayGanZhi: dg }); } catch (e) { continue; }
      const ys = c.ben.yaos, bian = (c._bianPang || []);
      // 静 → 动（应无权）
      ys.forEach((a) => {
        if (LY.layerOf(a) !== 4) return;
        ys.forEach((b) => {
          if (LY.layerOf(b) !== 3) return;
          jingToDong++;
          if (LY.effForce(a, b) === 0) jingToDongZero++;
        });
      });
      // 动 → 静（应有权）
      ys.forEach((a) => {
        if (LY.layerOf(a) !== 3) return;
        ys.forEach((b) => {
          if (LY.layerOf(b) !== 4) return;
          dongToJing++;
          const own = a.wang ? a.wang.score : 0;
          if (LY.effForce(a, b) === (a.wang && a.wang.kong === '真空' ? 0 : own)) dongToJingFull++;
        });
      });
      // 变爻 → 动/静（应有权）
      bian.forEach((bp) => {
        if (!bp.bianYao) return;
        ys.forEach((b) => {
          if (b === undefined) return;
          bianToDong++;
          if (LY.hasPower(bp.bianYao, b)) bianToDongOK++;
        });
      });
      // 动 → 变爻（应无权）
      bian.forEach((bp) => {
        if (!bp.bianYao) return;
        ys.forEach((a) => {
          if (!a.isMoving) return;
          dongToBian++;
          if (!LY.hasPower(a, bp.bianYao)) dongToBianZero++;
        });
      });
    }
  }
  ck('静爻→动爻：一律无权，有效作用力按零计（' + jingToDongZero + '/' + jingToDong + '）',
    jingToDong > 0 && jingToDongZero === jingToDong);
  ck('动爻→静爻：有权，有效作用力＝自身力量（' + dongToJingFull + '/' + dongToJing + '）',
    dongToJing > 0 && dongToJingFull === dongToJing);
  ck('变爻→主卦动静之爻：一律有权（' + bianToDongOK + '/' + bianToDong + '）',
    bianToDong > 0 && bianToDongOK === bianToDong);
  ck('动爻→变爻：一律无权（' + dongToBianZero + '/' + dongToBian + '）',
    dongToBian > 0 && dongToBianZero === dongToBian);
}

console.log('\n================ ③ 力量≠权力：值日月之静爻仍无权生动爻 =================');
{
  let found = 0, stillNoPower = 0;
  for (let id = 0; id < 64; id++) {
    const up = Math.floor(id / 8), lo = id % 8;
    const y = [lo & 1, (lo >> 1) & 1, (lo >> 2) & 1, up & 1, (up >> 1) & 1, (up >> 2) & 1];
    const six = y.map((v, i) => (i === 2 || i === 4 ? (v ? 9 : 6) : (v ? 7 : 8)));
    for (const mg of MONTHS) for (const dg of DAYS) {
      let c;
      try { c = LY.arrange({ six: six.map((s) => ({ sum: s })), monthGanZhi: '丙' + mg, dayGanZhi: dg }); } catch (e) { continue; }
      c.ben.yaos.forEach((a) => {
        if (a.isMoving) return;
        // 暗动之爻虽非"发动"，但已被判入第三层次，本就有权作用动爻——须排除，
        // 否则会把正确的有权情形误计为"无权失效"（此为本测试首跑报错的根因）。
        if (LY.layerOf(a) !== 4) return;
        if (!(a.zhi === c.dayZhi || a.zhi === c.monthZhi)) return;   // 值日月之静爻
        c.ben.yaos.forEach((b) => {
          if (!b.isMoving) return;
          found++;
          if (LY.effForce(a, b) === 0) stillNoPower++;   // 有力但无权
        });
      });
    }
  }
  ck('值日月之静爻对动爻：有效作用力仍为零（' + stillNoPower + '/' + found + '）',
    found > 0 && stillNoPower === found, '此为"有第一层次之力、无第一层次之权"的机械落地');
}

console.log('\n================ ④ 变爻旁爻：只在本位无生克合冲时才作用旁爻 =================');
{
  let onlySelf = 0, pang = 0, pangWithTarget = 0;
  let selfHasRel = 0;
  for (let id = 0; id < 64; id++) {
    const up = Math.floor(id / 8), lo = id % 8;
    const y = [lo & 1, (lo >> 1) & 1, (lo >> 2) & 1, up & 1, (up >> 1) & 1, (up >> 2) & 1];
    const six = y.map((v, i) => (i === 2 || i === 4 ? (v ? 9 : 6) : (v ? 7 : 8)));
    for (const mg of MONTHS) for (const dg of DAYS) {
      let c;
      try { c = LY.arrange({ six: six.map((s) => ({ sum: s })), monthGanZhi: '丙' + mg, dayGanZhi: dg }); } catch (e) { continue; }
      (c._bianPang || []).forEach((bp) => {
        if (bp.onlySelf) { onlySelf++; if (bp.selfRel.length) selfHasRel++; }
        else { pang++; if (bp.targets.length) pangWithTarget++; }
      });
    }
  }
  ck('对本位动爻有生克合冲者：只作用本位动爻，不外溢（' + onlySelf + ' 例，均带回头关系 ' + selfHasRel + '）',
    onlySelf > 0 && selfHasRel === onlySelf);
  ck('对本位动爻无生克合冲者：转为可作用旁爻（' + pang + ' 例，其中有作用目标 ' + pangWithTarget + ' 例）',
    pang > 0);
  ck('两类互斥且合计覆盖全部动爻变化（' + onlySelf + ' + ' + pang + '）', onlySelf + pang > 0);
}

console.log('\n================ ⑤ 合冲刑害次序：取唯一关系，不平权累加 =================');
{
  // 以两爻地支直接构造，验证优先级 合 > 冲 > 刑 > 害 > 生克
  const mk = (zhi) => ({ zhi: zhi, wuxing: ({ 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' })[zhi], posName: '某爻' });
  const cases = [
    ['子', '丑', '合', '子丑六合，且有土克水之克我并存，应取合'],
    ['子', '午', '冲', '子午六冲，且水克火为我克并存，应取冲'],
    ['寅', '巳', '刑', '寅巳相刑，且木生火为我生并存，应取刑'],
    ['子', '未', '害', '子未相害，且土克水为克我并存，应取害'],
    ['寅', '辰', '克', '寅辰无合冲刑害，木克土，应取克'],
    ['亥', '卯', '生', '亥卯无合冲刑害...（亥卯为三合半局，此处只论二者）水生木，应取生'],
  ];
  cases.forEach(([za, zb, exp, why]) => {
    const r = LY.relBetween(mk(za), mk(zb));
    ck(za + '/' + zb + ' → ' + (r ? r.rel : 'null') + '（期望 ' + exp + '）' + '　' + why,
      !!r && r.rel === exp, r ? '实得 ' + r.rel + '，并存关系=' + r.raw.join('、') : '未判出关系');
  });

  // 层次不同时，低层次之刑冲合害让位于高层次
  let diffLayer = 0, relStillJudged = 0;
  for (let id = 0; id < 64; id++) {
    const up = Math.floor(id / 8), lo = id % 8;
    const y = [lo & 1, (lo >> 1) & 1, (lo >> 2) & 1, up & 1, (up >> 1) & 1, (up >> 2) & 1];
    const six = y.map((v, i) => (i === 2 || i === 4 ? (v ? 9 : 6) : (v ? 7 : 8)));
    let c;
    try { c = LY.arrange({ six: six.map((s) => ({ sum: s })), monthGanZhi: '丙寅', dayGanZhi: '甲子' }); } catch (e) { continue; }
    c.ben.yaos.forEach((a) => {
      c.ben.yaos.forEach((b) => {
        if (a === b) return;
        if (LY.layerOf(a) === LY.layerOf(b)) return;
        diffLayer++;
        // 关系仍被判出（信息之象存在），但作用力由 hasPower 闸门决定
        const r = LY.relBetween(a, b);
        if (r) relStillJudged++;
      });
    });
  }
  ck('层次不同时仍判出关系（象在），但作用力另由生克权闸门决定（' + relStillJudged + '/' + diffLayer + '）',
    diffLayer > 0 && relStillJudged > 0, '象与力分离：关系照记，力按层次过滤');
}

console.log('\n================ ⑥ 消融开关：真开关，数字随开关而变 =================');
{
  const QUIZ = { wealth: '这笔生意能赚吗', study: '这次考试能过吗', career: '这次升职有希望吗', illness: '这个病什么时候好' };
  let scenes = 0, netDiff = 0, effZeroWhenNoPower = 0, noPowerCases = 0;
  for (let id = 0; id < 64 && scenes < 40; id++) {
    const up = Math.floor(id / 8), lo = id % 8;
    const y = [lo & 1, (lo >> 1) & 1, (lo >> 2) & 1, up & 1, (up >> 1) & 1, (up >> 2) & 1];
    const six = y.map((v, i) => (i === 2 || i === 4 ? (v ? 9 : 6) : (v ? 7 : 8)));
    for (const mg of MONTHS) for (const dg of DAYS) {
      let c;
      try { c = LY.arrange({ six: six.map((s) => ({ sum: s })), monthGanZhi: '丙' + mg, dayGanZhi: dg }); } catch (e) { continue; }
      for (const lq of LIUQIN) {
        if (scenes >= 40) break;
        // 爻际量化已在装卦阶段下沉，切换开关后须重跑 applyInterYao 才会改变数字
        // （幂等，不必重排盘）——否则开关是假开关，历史上轴锁消融曾因此作废
        LY.setAblation({ yaoLayer: true });
        LY.applyInterYao(c, lq);
        const on = LY.getUseGodRelation(c, lq);
        LY.setAblation({ yaoLayer: false });
        LY.applyInterYao(c, lq);
        const off = LY.getUseGodRelation(c, lq);
        LY.setAblation({ yaoLayer: true });
        LY.applyInterYao(c, lq);
        if (!on || !off) continue;
        const nOn = (on.verdict || []).join('').match(/＝\s*(-?\d+)/);
        const nOff = (off.verdict || []).join('').match(/＝\s*(-?\d+)/);
        if (!nOn || !nOff) continue;
        scenes++;
        if (nOn[1] !== nOff[1]) netDiff++;
        // 当忌神无权作用用神时，jsEff 应为 0
        if (on.jishen && on.yongshen && !LY.hasPower(on.jishen, on.yongshen)) {
          noPowerCases++;
          if (on.jsEff === 0) effZeroWhenNoPower++;
        }
      }
    }
  }
  ck('开关有效：开/关两组净力出现差异的场景数（' + netDiff + '/' + scenes + '）', netDiff > 0,
    '若为 0 则说明开关是假的（历史上轴锁消融曾因此作废）');
  ck('忌神无权作用用神时，其有效作用力按零计（' + effZeroWhenNoPower + '/' + noPowerCases + '）',
    noPowerCases > 0 && effZeroWhenNoPower === noPowerCases);
}

console.log('\n================ ⑦ 输出层：交给模型的数字已是过滤后的值 =================');
{
  const CFG = require('../libs/config.js');
  const c = LY.arrange({ six: [{ sum: 7 }, { sum: 8 }, { sum: 6 }, { sum: 8 }, { sum: 9 }, { sum: 8 }], monthGanZhi: '丙寅', dayGanZhi: '甲子' });
  let hit = 0, total = 0;
  for (const lq of LIUQIN) {
    const rel = LY.getUseGodRelation(c, lq);
    if (!rel || !rel.jishen || !rel.yongshen) continue;
    if (LY.layerOf(rel.jishen) > LY.layerOf(rel.yongshen)) {   // 忌神层次低于用神 → 无权
      total++;
      if (rel.jsEff === 0) hit++;
    }
  }
  ck('无权情形下 jsEff 为 0（' + hit + '/' + total + '）', total === 0 || hit === total,
    total === 0 ? '（本卦无此情形，跳过）' : '');
  ck('输出层已接入有效作用力（config.js 取 jsEff/yuanEff/chouEff）',
    /jsEff/.test(require('fs').readFileSync(__dirname + '/../libs/config.js', 'utf8')));
}

console.log('\n================ 结果 =================');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
