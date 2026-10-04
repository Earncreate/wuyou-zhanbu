/* 古籍案例 × 引擎 机械对照（每模块 3 例，用书中原问法 + 书中月建日辰）
 *
 * 设计原则（吸取上一版教训）：
 *   ① 断言数据全部来自 tmp/classic_book.js —— 逐爻照抄原书排盘（含天干），
 *      程序不手填爻位，杜绝"爻序搞反 / 旬空填错"这类伪失败。
 *   ② 旬空一律由引擎 calcXunKong 现算，书上标注只作对照。
 *   ③ 用神断言只提示、不判失败（模块间用神体系不同，如 career 用官鬼、
 *      占终身财福用妻财），目的是暴露差异供人工判断。
 *
 * 不烧 key、不问模型，纯机械对照。
 * 用法：node tmp/classic_verify.js [模块id]
 */
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');
const { solveCast } = require('./solve_cast.js');
const BOOK = require('./classic_book.js');

function gb0(chart){ return chart.bian ? chart.bian.name : '（静卦）'; }

function yaoByPos(chart, pos) { return chart.ben.yaos.filter((y) => y.pos === pos)[0]; }

/* 野鹤式"生机链"检查：看用神是否处在"被连续相生"或"全无生机"的状态。
 * 这不是引擎功能，而是把原书断语口径（生机有无）落成可核验的数字事实：
 *   生机来源＝生用神者（原神）+ 帮身者（月建/日辰/动爻），
 *   死路＝克用神者（忌神）旺动 + 用神入墓/空破/自刑。 */
function shengjiChain(chart, usePos) {
  const y = yaoByPos(chart, usePos);
  if (!y) return null;
  const wuxing = y.wuxing;
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const child = SHENG[wuxing];   // 生我者＝原神
  const killer = KE[wuxing];     // 克我者＝忌神
  const yuan = chart.ben.yaos.filter((o) => o.pos !== usePos && o.wuxing === child);
  const ji = chart.ben.yaos.filter((o) => o.pos !== usePos && o.wuxing === killer);
  const yuanActive = yuan.filter((o) => o.isMoving || (o.wang.dayFlags || []).length || o.wang.score > 0);
  const jiActive = ji.filter((o) => o.isMoving && o.wang.score > 0);
  return {
    use: wuxing + '(' + y.ganzhi + ')',
    yingqi: y.liuqin, yuanSheng: yuan.map((o) => o.pos + o.zhi + (o.isMoving ? '动' : '')),
    jiSha: ji.map((o) => o.pos + o.zhi + (o.isMoving ? '动' : '')),
    yuanActive: yuanActive.length, jiActive: jiActive.length,
    ruMu: /墓/.test(y.changsheng || ''), kong: !!y.isKong, yuepo: !!y.isYuePo,
    score: y.wang.score, level: y.wang.level
  };
}

function run(modFilter) {
  let pass = 0, fail = 0, info = 0;
  const failList = [], out = [];

  for (const c of BOOK) {
    if (modFilter && c.mod !== modFilter) continue;
    const r = c.partialBian
      ? solveCast(c.ben, null)                       // 原书未载变卦：按本卦装，逐爻仍可对照
      : solveCast(c.ben, c.bian);
    const rec = { mod: c.mod, q: c.q, gua: c.ben + (c.bian && !c.partialBian ? ' 之 ' + c.bian : ''), gz: c.mz + '月' + c.dz + '日', items: [] };
    if (!r.ok) {
      rec.items.push({ n: '装卦', want: c.ben, got: r.why, st: 'fail' });
      fail++; failList.push({ mod: c.mod, gua: rec.gua, item: rec.items[0] }); out.push(rec); continue;
    }
    const chart = LY.arrange({ six: r.six, monthGanZhi: c.mz, dayGanZhi: c.dz });

    rec.items.push({ n: '卦体', want: c.ben, got: chart.ben.name, st: chart.ben.name === c.ben ? 'pass' : 'fail' });
    if (!c.partialBian) {
      const gb = chart.bian ? chart.bian.name : null;
      rec.items.push({ n: '变卦', want: c.bian || '（静卦）', got: gb || '（静卦）', st: gb === (c.bian || null) ? 'pass' : 'fail' });
    } else {
      rec.items.push({ n: '变卦', want: '（原书未载变卦名）', got: '按本卦装，仅对照逐爻', st: 'info' });
      info++;
    }

    const kong = (chart.xunkong || []).join('');
    if (c.kong) rec.items.push({ n: '旬空', want: c.kong, got: kong, st: kong === c.kong ? 'pass' : 'fail' });
    else { rec.items.push({ n: '旬空', want: '（原书只载日支' + (c.dayZhiOnly || '?') + '·未载日干，不核对）', got: kong, st: 'info' }); info++; }

    c.rows.forEach((b) => {
      const y = yaoByPos(chart, b.pos);
      const t = b.pos + '爻';
      if (!y) { rec.items.push({ n: t, want: b.ganzhi + b.lq, got: '无此爻', st: 'fail' }); return; }
      rec.items.push({ n: t + '干支', want: b.ganzhi, got: y.ganzhi, st: b.ganzhi === y.ganzhi ? 'pass' : 'fail' });
      if (b.lq) rec.items.push({ n: t + '六亲', want: b.lq, got: y.liuqin, st: b.lq === y.liuqin ? 'pass' : 'fail' });
      if (b.shi !== undefined) rec.items.push({ n: t + '世', want: String(!!b.shi), got: String(!!y.isShi), st: !!y.isShi === !!b.shi ? 'pass' : 'fail' });
      if (b.ying !== undefined) rec.items.push({ n: t + '应', want: String(!!b.ying), got: String(!!y.isYing), st: !!y.isYing === !!b.ying ? 'pass' : 'fail' });
      if (b.moving !== undefined) {
        if (c.partialBian) { rec.items.push({ n: t + '动', want: String(!!b.moving), got: (!!y.isMoving ? '动' : '静') + '（原书未载变卦，动爻集不可比对）', st: 'info' }); info++; }
        else rec.items.push({ n: t + '动', want: String(!!b.moving), got: String(!!y.isMoving), st: !!y.isMoving === !!b.moving ? 'pass' : 'fail' });
      }
      if (b.yuepo !== undefined) rec.items.push({ n: t + '月破', want: String(!!b.yuepo), got: String(!!y.isYuePo), st: !!y.isYuePo === !!b.yuepo ? 'pass' : 'fail' });
      if (b.kong !== undefined) rec.items.push({ n: t + '空', want: String(!!b.kong), got: String(!!y.isKong), st: !!y.isKong === !!b.kong ? 'pass' : 'fail' });
    });

    // 用神（只提示，暴露模块用神差异）
    const ug = SYM.resolveUseGod(c.mod, c.q, chart);
    rec.useGod = { book: c.useGod, engine: ug.useLq, source: ug.source, why: c.useGodSrc };
    // 生机链（供人工对照原书"生机有无"口径）
    let sjPos = null;
    const yc = c.rows.filter((b) => b.lq === c.useGod && b.shi);
    const yc2 = c.rows.filter((b) => b.lq === c.useGod);
    if (yc.length === 1) sjPos = yc[0].pos;
    else if (yc2.length === 1) sjPos = yc2[0].pos;
    if (sjPos) rec.shengji = shengjiChain(chart, sjPos);

    rec.expect = c.expect; rec.key = c.key; rec.src = c.src;
    rec.items.forEach((it) => {
      if (it.st === 'pass') pass++;
      else if (it.st === 'info') { /* 已在产生处累计 info */ }
      else { fail++; failList.push({ mod: c.mod, gua: rec.gua, item: it }); }
    });
    out.push(rec);
  }

  // ── 报告
  console.log('═══════════ 《增删卜易》原书案例 × 引擎 机械对照' + (modFilter ? '（' + modFilter + '）' : '（全部）') + '═══════════');
  out.forEach((rec) => {
    console.log('\n【' + rec.mod + '】' + rec.q);
    console.log('   ' + rec.gua + '　' + rec.gz);
    rec.items.forEach((it) => { const m = it.st === 'pass' ? '✓' : (it.st === 'info' ? '○' : '✗'); console.log('   ' + m + ' ' + it.n + '：书「' + it.want + '」　引擎「' + it.got + '」'); });
    if (rec.useGod) {
      const u = rec.useGod;
      const same = u.book === u.engine;
      info++;
      console.log('   ○ 用神：书「' + u.book + '」　引擎「' + u.engine + '」（' + u.source + '）' + (same ? '　一致' : '　★差异'));
      console.log('     书用神依据：' + u.why);
    }
    if (rec.shengji) {
      const s = rec.shengji;
      console.log('   ○ 生机链（用神' + s.use + '）：原神[' + s.yuanSheng.join(' ') + ' 旺动' + s.yuanActive + ']　忌神[' + s.jiSha.join(' ') + ' 旺动' + s.jiActive + ']'
        + '　入墓' + (s.ruMu ? '是' : '否') + '　旬空' + (s.kong ? '是' : '否') + '　月破' + (s.yuepo ? '是' : '否') + '　旺衰' + s.level + '(' + s.score + ')');
    }
    if (rec.key) console.log('   ★ 案例要点：' + rec.key);
    if (rec.src) console.log('   · 出处：' + rec.src);
    if (rec.expect) console.log('   书中断语：' + rec.expect);
  });
  console.log('\n────────────────────────────────');
  console.log('机械断言：通过 ' + pass + '　不符 ' + fail + '　用神提示 ' + info);
  if (failList.length) {
    console.log('\n不符明细：');
    failList.forEach((f) => console.log('  ✗ [' + f.mod + '] ' + f.gua + '　' + f.item.n + '：书「' + f.item.want + '」引擎「' + f.item.got + '」'));
  }
  return { pass, fail, info };
}

if (require.main === module) run(process.argv[2] || null);
module.exports = { run, BOOK };
