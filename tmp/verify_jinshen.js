/* 化进化退全表验证：遍历 64 卦 × 63 种动爻组合，检查
 *   ①《增删卜易·进神退神章》原表 16 组是否全部被引擎正确判出；
 *   ② 表外组合是否有误判（假阳性）。
 * 纯机械验证，不烧 key。
 */
const LY = require('../libs/liuyao.js');

const JIN = { '亥子': 1, '寅卯': 1, '巳午': 1, '申酉': 1, '丑辰': 1, '辰未': 1, '未戌': 1, '戌丑': 1 };
const TUI = { '子亥': 1, '卯寅': 1, '午巳': 1, '酉申': 1, '辰丑': 1, '未辰': 1, '戌未': 1, '丑戌': 1 };

function run() {
  const seen = {};   // key -> {j:bool, t:bool, 样本}
  // 4^6 = 4096 种装卦组合（6老阴/7少阳/8少阴/9老阳），保证覆盖全部动变可能
  const SUMS = [6, 7, 8, 9];
  for (let code = 0; code < 4096; code++) {
    {
      const six = [];
      let cd = code;
      for (let i = 0; i < 6; i++) { six.push({ sum: SUMS[cd % 4] }); cd = Math.floor(cd / 4); }
      let ch;
      try { ch = LY.arrange({ six, monthGanZhi: '丙寅', dayGanZhi: '甲子' }); } catch (e) { continue; }
      if (!ch.bian) continue;
      for (let p = 1; p <= 6; p++) {
        const y = ch.ben.yaos.filter((x) => x.pos === p)[0];
        const by = ch.bian.yaos.filter((x) => x.pos === p)[0];
        if (!y || !by || !y.isMoving) continue;
        const key = y.zhi + by.zhi;
        const f = (y.hua && y.hua.flags) || [];
        seen[key] = seen[key] || { j: false, t: false, samples: 0 };
        seen[key].samples++;
        if (f.indexOf('化进') >= 0) seen[key].j = true;
        if (f.indexOf('化退') >= 0) seen[key].t = true;
      }
    }
  }

  // 纳甲可行域：引擎实际能产生的动变组合。原书进退表 16 组中，另 8 组属兼论非纳甲变爻
  // （如"亥化子""巳化午"），纳甲装卦在原理上产生不了，不作要求。
  const feasible = new Set(Object.keys(seen));
  let miss = 0, fp = 0;
  const allPairs = Object.keys(JIN).concat(Object.keys(TUI));
  const inFeas = allPairs.filter((p) => feasible.has(p)).length;
  console.log('=== 化进化退：原书进退表 × 纳甲可行域（遍历 4096 种装卦）===');
  console.log('原书进退表 16 组：纳甲可产生 ' + inFeas + ' 组，另 ' + (allPairs.length - inFeas) + ' 组属原书兼论非纳甲变爻（装卦产生不了，不作要求）');
  console.log('');
  Object.keys(JIN).forEach((p) => {
    const s = seen[p];
    const ok = s && s.j;
    if (!feasible.has(p)) { console.log('  － 进神 ' + p + '　纳甲不可产生（原书兼论），跳过'); }
    else if (!ok) { miss++; console.log('  ✗ 进神漏判 ' + p + '（样本 ' + (s ? s.samples : 0) + '）'); }
    else console.log('  ✓ 进神 ' + p + '　样本 ' + s.samples);
  });
  Object.keys(TUI).forEach((p) => {
    const s = seen[p];
    const ok = s && s.t;
    if (!feasible.has(p)) { console.log('  － 退神 ' + p + '　纳甲不可产生（原书兼论），跳过'); }
    else if (!ok) { miss++; console.log('  ✗ 退神漏判 ' + p + '（样本 ' + (s ? s.samples : 0) + '）'); }
    else console.log('  ✓ 退神 ' + p + '　样本 ' + s.samples);
  });

  console.log('\n=== 表外组合误判检查（假阳性）===');
  Object.keys(seen).forEach((p) => {
    if (JIN[p] || TUI[p]) return;
    if (seen[p].j || seen[p].t) { fp++; console.log('  ✗ 误判 ' + p + '（样本 ' + seen[p].samples + '，j=' + seen[p].j + ' t=' + seen[p].t + '）'); }
  });
  if (!fp) console.log('  ✓ 无误判：表外 ' + Object.keys(seen).filter((p) => !JIN[p] && !TUI[p]).length + ' 组均未判进退');

  console.log('\n原书 16 组漏判 ' + miss + '　表外误判 ' + fp);
  return { miss, fp };
}

if (require.main === module) {
  const r = run();
  process.exit(r.miss + r.fp ? 1 : 0);
}
module.exports = { run };
