/* 从「本卦名 + 变卦名」反推装卦（six sums），用于精确复现古籍原例。
 *
 * 原理：arrange 收 six[i].sum（6 老阴动／7 少阳静／8 少阴静／9 老阳动），
 * 由 sixYang 数组定本卦、由 moving 位定变卦。已知本卦与变卦时，
 * 变卦的爻位在动爻上必须与本卦相反、其余相同 —— 由此唯一解出动爻集合。
 *
 * 输出：{ six:[{sum}], moving:[pos...], ok, why }
 * 若本卦无变卦（静卦）则 moving=[]，全静。
 */
const LY = require('../libs/liuyao.js');

function guaByName(name) {
  const g = LY.GUA64;
  for (const k of Object.keys(g)) if (g[k].name === name) return g[k];
  return null;
}

// bits: 初爻→上爻，1 阳 0 阴（由 TRIGRAM 定义）
function bitsOfGuaName(name) {
  const it = guaByName(name);
  if (!it) return null;
  return LY.TRIGRAM[it.lower].bits.concat(LY.TRIGRAM[it.upper].bits);
}

function sumOfYang(isYang, moving) { return isYang ? (moving ? 9 : 7) : (moving ? 6 : 8); }

/**
 * @param {string} benName 本卦名（如 '风天小畜'）
 * @param {string|null} bianName 变卦名；null/false/'无'/'静' 表示按静卦处理
 */
function solveCast(benName, bianName) {
  const benBits = bitsOfGuaName(benName);
  if (!benBits) return { ok: false, why: '未知本卦名：' + benName };

  const noBian = !bianName || /^(无|静|null|undefined|NULL|)$/.test(String(bianName));
  if (noBian) {
    return {
      ok: true, six: benBits.map((y) => ({ sum: sumOfYang(!!y, false) })),
      moving: [], note: '按静卦装（书例未载变卦）'
    };
  }

  const bianBits = bitsOfGuaName(bianName);
  if (!bianBits) return { ok: false, why: '未知变卦名：' + bianName };

  // 动爻位：仅在变卦与本卦爻象不同处；相同处必须是静爻
  const mustMove = [];
  const mustStatic = [];
  for (let i = 0; i < 6; i++) {
    if (bianBits[i] !== benBits[i]) mustMove.push(i);
    else mustStatic.push(i);
  }
  if (mustMove.length === 0) {
    return { ok: false, why: '本卦与变卦爻象全同，动爻无法确定（需原书动爻信息）' };
  }
  // 六爻不可能全动（变卦为纯阳/纯阴时另一端必有同位），此处仅做健全性检查
  if (mustMove.length === 6) {
    return { ok: false, why: '六爻皆动，本程序不支持（老阴老阳全动）' };
  }
  const six = benBits.map((y, i) => ({ sum: sumOfYang(!!y, mustMove.indexOf(i) >= 0) }));
  return {
    ok: true, six,
    moving: mustMove.map((i) => i + 1),
    note: '由本卦/变卦爻象差异唯一确定动爻'
  };
}

module.exports = { solveCast, bitsOfGuaName, guaByName };

if (require.main === module) {
  const CASES = require('./classic_cases.js');
  let ok = 0, skip = 0, bad = 0;
  for (const c of CASES) {
    if (c.skip) { skip++; console.log('  [跳过] ' + c.mod + '：' + c.skip); continue; }
    const r = solveCast(c.ben, c.bian);
    if (!r.ok) { bad++; console.log('  [失败] ' + c.mod + ' ' + c.ben + '→' + c.bian + '：' + r.why); continue; }
    const chart = LY.arrange({ six: r.six, monthGanZhi: c.mz, dayGanZhi: c.dz });
    const gotBen = chart.ben.name;
    const gotBian = chart.bian ? chart.bian.name : null;
    const benOk = gotBen === c.ben;
    const bianOk = (c.bian ? gotBian === c.bian : true);
    const mark = (benOk && bianOk) ? '✓' : '✗';
    if (benOk && bianOk) ok++; else bad++;
    console.log('  [' + mark + '] ' + c.mod + '｜' + c.ben + (c.bian ? ' 之 ' + c.bian : '（静）')
      + '｜动爻[' + (r.moving.join(',') || '无') + ']｜' + c.mz + '月' + c.dz + '日'
      + '｜引擎装出：' + gotBen + (gotBian ? ' 之 ' + gotBian : '')
      + '｜旬空' + (chart.xunkong || '?')
      + (benOk && bianOk ? '' : '  ← 装卦不符！'));
  }
  console.log('\n小结：可复现 ' + ok + '，装卦不符 ' + bad + '，按收录标准跳过 ' + skip);
}
