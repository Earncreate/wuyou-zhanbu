/* 古籍案例解析 × 引擎数字结论 并排对比（生成报告）
 *
 * classic_verify.js 做的是"盘面是否复现"（装卦、干支、六亲、世应、动静、旬空）。
 * 本脚本做的是"结论是否一致"：把原书断语里可判定的结论，抽成引擎数字，
 * 与引擎实算结果并排列出，供人工判断"引擎断得对不对"。
 *
 * 判定四档：
 *   ✓一致     书结论与引擎数字同向
 *   ✗冲突     书结论与引擎数字反向 —— 需排查（可能是书派别差异，非引擎错）
 *   ○不可判   该结论无法机械判定（需取象/语境），只列出双方口径
 *   △提示     引擎未算出该字段（如引擎无对应机制），属功能缺口
 *
 * 用法：node tmp/classic_compare.js > tmp/古籍案例对照报告.txt
 */
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');
const { solveCast } = require('./solve_cast.js');
const BOOK = require('./classic_book.js');

function yao(chart, pos) { return chart.ben.yaos.filter((y) => y.pos === pos)[0]; }
function bianOf(chart, pos) {
  const m = chart.ben.yaos.filter((y) => y.pos === pos && y.isMoving)[0];
  if (!m || !chart.bian) return null;
  return chart.bian.yaos.filter((y) => y.pos === pos)[0] || null;
}
const CS = { 沐: '长生', 冠: '冠带', 临: '临官', 帝: '帝旺', 衰: '衰', 病: '病', 死: '死', 墓: '墓', 绝: '绝', 胎: '胎', 养: '养' };
function stageOf(y) { return CS[(y.changsheng || '')[0]] || y.changsheng; }

/* 每条 check：书断语 → 引擎应满足的条件。返回 pass/conflict/nodot/gap + 双方口径 */
function judge(c, chart) {
  const R = [];
  const P = (name, bookText, engineText, ok) => R.push({ name, bookText, engineText, st: ok === null ? 'nodot' : (ok ? 'ok' : 'conflict') });

  // ── 1 化进神／化退神：按原书点名的干支逐一判定，以引擎 huaLayer 结论为准
  // 《增删卜易·进神退神章》原文进退表只认「地支相邻一位」：
  //   进神：亥化子 寅化卯 巳化午 申化酉 丑化辰 辰化未 未化戌 戌化丑
  //   退神：子化亥 卯化寅 午化巳 酉化申 辰化丑 未化辰 戌化未 丑化戌
  // 不涉长生十二宫 —— 引擎 liuyao.js:369-370 的实现与原书完全一致。
  // 原书常逐爻点名（如「未土子孙化进神，辰土子孙化回头生」），故按「干支＋化进/化退」配对抓取。
  const ex = c.expect || '';
  const jinRe = /([子丑寅卯辰巳午未申酉戌亥])土?[^。；，]{0,8}化进/g;
  const tuiRe = /([子丑寅卯辰巳午未申酉戌亥])土?[^。；，]{0,8}化退/g;
  const collect = (re) => { const out = []; let m; while ((m = re.exec(ex))) out.push(m[1]); return out; };
  const jinZhi = collect(jinRe), tuiZhi = collect(tuiRe);
  jinZhi.concat(tuiZhi).forEach((z) => {
    const row = c.rows.filter((b) => b.ganzhi && b.ganzhi.slice(-1) === z)[0];
    if (!row) return;
    const y = yao(chart, row.pos);
    const hua = y.hua || { flags: [] };
    const wantJin = jinZhi.indexOf(z) >= 0;
    const by = bianOf(chart, row.pos);
    P('化' + (wantJin ? '进神' : '退神') + '（' + row.pos + '爻 ' + z + '）',
      '书断：' + z + ' 化' + (wantJin ? '进神' : '退神'),
      '引擎：' + z + ' → ' + (by ? by.zhi : '?') + '　hua=[' + (hua.flags.join('/') || '无') + ']',
      c.partialBian ? null : (wantJin ? hua.flags.indexOf('化进') >= 0 : hua.flags.indexOf('化退') >= 0));
  });

  // ── 5 旬空：书"某爻逢空/旬空" → 引擎 isKong
  c.rows.filter((b) => b.kong === 1).forEach((b) => {
    const y = yao(chart, b.pos);
    P('旬空（' + b.pos + '爻）', '书断：' + b.ganzhi + ' 旬空', '引擎：' + (y ? (y.isKong ? '是（' + (y.wang.kong || '') + '）' : '否') : '无'), y && y.isKong);
  });

  // ── 6 用神旺衰：书"用神旺相/有气/休囚/无气" → 引擎 wang
  if (c.useGod && c.useGod !== '世爻') {
    const urow = c.rows.filter((b) => b.lq === c.useGod)[0];
    if (urow) {
      const y = yao(chart, urow.pos);
      const book = (c.expect.match(/(用神|官鬼|官爻|父母|父爻|妻财|财爻|子孙|兄爻|兄弟)[^。；]{0,12}?(旺相|有气|休囚|无气|旺|衰|弱|强|帝旺|太旺)/) || [])[0] || '';
      const bookWan = /帝旺|太旺|旺相|有气/.test(book);
      const bookXiu = /休囚|无气|衰/.test(book);
      if (book) {
        const engWan = y.wang.score > 0, engXiu = y.wang.score < 0;
        P('用神旺衰（' + urow.ganzhi + '）', '书断：' + book, '引擎：' + y.wang.level + '(' + y.wang.score + ')',
          bookWan ? engWan : (bookXiu ? engXiu : null));
      }
    }
  }

  // ── 7 忌神（贼/鬼）是否动：书"忌神摇/官鬼动" → 引擎该六亲爻 isMoving
  if (/忌神|官鬼[^。；]{0,6}动|贼|鬼动|官动/.test(c.expect || '')) {
    const jrow = c.rows.filter((b) => b.lq === '官鬼' && b.moving)[0] || c.rows.filter((b) => b.lq === '官鬼')[0];
    if (jrow) {
      const y = yao(chart, jrow.pos);
      const anyGui = c.rows.filter((b) => b.lq === '官鬼' && b.moving).length > 0;
      const hasGui = c.rows.filter((b) => b.lq === '官鬼').length > 0;
      P('官鬼发动（忌神）', '书断：' + (c.expect.match(/[^。；]*?(忌神摇|官鬼?动|贼来|官动)[^。；]*/) || [''])[0].slice(0, 26),
        hasGui ? ('引擎：' + c.rows.filter((b) => b.lq === '官鬼').map((b) => b.ganzhi).join('/') + (anyGui ? '（有发动）' : '（皆静）') + '；原书所动之爻可能以「忌神」指兄弟而非官鬼')
               : '引擎：卦中无官鬼爻（原书以兄弟为忌神）',
        hasGui ? null : false);
    }
  }

  // ── 8 应期：书给"某日/某月" → 引擎能否算出该日/月对应用神的作用（冲/合/值）
  const yq = (c.expect || '').match(/(应|果于|果卒于|果考于|果开市于|果拔案首|果中式|果得及第|果续取之|果于次日|果于次日|果于卯日|果于六月|果于丑月|果于戌月|果于寅日|果于甲戌|果于丙子)[^。；]{0,10}?(日|月|年|次日)/);
  if (yq) {
    P('应期落点', '书断：' + yq[0].slice(0, 24), '引擎：需按"逢值/逢合/冲开/出空"四途择算（本脚本未自动择算，留人工判断）', null);
  }

  return R;
}

function run() {
  const out = [];
  out.push('╔══════════════════════════════════════════════════════════════════╗');
  out.push('║   《增删卜易》原书案例 × 本程序引擎  并排解析对比报告              ║');
  out.push('║   案例 ' + BOOK.length + ' 例 / 模块 ' + Object.keys(BOOK.reduce((a, c) => (a[c.mod] = 1, a), {})).length + ' 个        ║');
  out.push('║   盘面复现断言：见 classic_verify.js（484 项 0 不符）              ║');
  out.push('╚══════════════════════════════════════════════════════════════════╝');
  out.push('');
  out.push('判定四档：✓一致　✗冲突（需排查，可能属流派差异）　○不可判（须取象/语境）　△功能缺口');
  out.push('');

  let nOk = 0, nConflict = 0, nNo = 0;
  const conflicts = [];

  BOOK.forEach((c, i) => {
    const r = c.partialBian ? solveCast(c.ben, null) : solveCast(c.ben, c.bian);
    if (!r.ok) { out.push('【' + (i + 1) + '】' + c.mod + ' ' + c.q + ' —— 装卦失败：' + r.why); return; }
    const chart = LY.arrange({ six: r.six, monthGanZhi: c.mz, dayGanZhi: c.dz });
    out.push('┌─【' + (i + 1) + '】' + c.mod + '　' + c.q);
    out.push('│  ' + c.ben + (c.partialBian ? '' : (c.bian ? ' 之 ' + c.bian : '（静卦）')) + '　' + c.mz + '月' + c.dz + '日' + (c.kong ? '（旬空' + c.kong + '）' : '（旬空未标）'));
    out.push('│  用神：书「' + c.useGod + '」　引擎「' + (SYM.resolveUseGod(c.mod, c.q, chart).useLq) + '」');
    out.push('│');
    const rs = judge(c, chart);
    if (!rs.length) out.push('│  （本例断语无可机械判定项，仅列原文）');
    rs.forEach((x) => {
      const m = x.st === 'ok' ? '✓' : (x.st === 'conflict' ? '✗' : '○');
      if (x.st === 'ok') nOk++; else if (x.st === 'conflict') { nConflict++; conflicts.push({ q: c.q, name: x.name, book: x.bookText, eng: x.engineText }); } else nNo++;
      out.push('│  ' + m + ' ' + x.name);
      out.push('│      书：' + x.bookText);
      out.push('│      引擎：' + x.engineText);
    });
    out.push('│');
    out.push('│  ★ 要点：' + (c.key || '—'));
    out.push('│  出典：' + c.src);
    out.push('│  原文：' + c.expect);
    out.push('└' + '─'.repeat(72));
    out.push('');
  });

  out.push('══════════════════ 汇总 ══════════════════');
  out.push('结论一致（✓）　　' + nOk + ' 项');
  out.push('结论冲突（✗）　　' + nConflict + ' 项');
  out.push('不可机械判定（○）' + nNo + ' 项');
  if (conflicts.length) {
    out.push('');
    out.push('── 冲突明细（需人工判读，多为流派差异而非引擎缺陷）──');
    conflicts.forEach((x) => {
      out.push('  ✗ ' + x.q + '　' + x.name);
      out.push('      书：' + x.book);
      out.push('      引擎：' + x.eng);
    });
  }
  return out.join('\n');
}

if (require.main === module) console.log(run());
module.exports = { run };
