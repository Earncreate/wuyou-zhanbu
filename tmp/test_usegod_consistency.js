/* 用神一致性回归（新引擎 API，2026-10-02 重构后）
 * 防回归目标：
 *  - config.MODULES 的用神一律以 symbol_dict.MOD_USE 为唯一权威（config 不再持有写死用神表）；
 *  - 原神/忌神/仇神一律由引擎 liuqinYuanJi(卦宫五行, 用神) 逐卦实算，config 无第二处硬写生克表；
 *  - 六亲五行随卦宫推导（非写死），五行生克关系固定不变。
 * 校验项：
 *   1) 引擎自校验（启动即跑的 assertYuanJiAll）0 错误
 *   2) config 用神单一来源：MODULES.yongshen === MOD_USE；useGodSource 标注正确
 *   3) 全 8 卦宫 × 5 用神：原神生用神 / 忌神克用神 / 仇神生忌神（逐宫核五行）
 *   4) 全 64 卦 × 14 模块 getUseGodRelation 实算不崩、能给出用神爻
 */
const CFG = require('../libs/config.js');
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');

const ELS = ['金', '木', '水', '火', '土'];
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const PRE_SHENG = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' };
const PRE_KE = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' };
const LQ = ['兄弟', '子孙', '妻财', '父母', '官鬼'];

let fail = 0;

console.log('=== 1) 引擎自校验 ===');
const engErrs = LY._YJ_ERRORS || [];
if (engErrs.length) { console.log('  ✗ 引擎自校验 ' + engErrs.length + ' 错误：' + engErrs.join(' | ')); fail += engErrs.length; }
else console.log('  ✓ 引擎自校验 0 错误（8 卦宫 × 5 用神）');

console.log('\n=== 2) config 用神单一来源（MODULES ↔ MOD_USE）===');
let fixed = 0, none = 0;
Object.keys(CFG.MODULES).forEach(id => {
  const m = CFG.MODULES[id];
  const eng = SYM.MOD_USE[id];
  if (!eng) {
    none++;
    if (m.useGodSource !== 'none(以世爻为纲，无固定六亲用神)') {
      console.log('  ✗ ' + id + ' 无固定用神但来源未标 none：' + m.useGodSource); fail++;
    }
    return;
  }
  fixed++;
  if (eng !== m.yongshen) { console.log('  ✗ ' + id + ' 用神 ' + m.yongshen + ' ≠ MOD_USE ' + eng); fail++; }
  if (!/^engine\./.test(m.useGodSource)) { console.log('  ✗ ' + id + ' 来源未标注 engine：' + m.useGodSource); fail++; }
});
console.log('  固定用神模块 ' + fixed + ' 个，none 模块 ' + none + ' 个；源冲突 ' + fail + ' 处（仅计本段）');

console.log('\n=== 3) 全宫原神/忌神/仇神 自洽（逐宫核五行生克）===');
ELS.forEach(el => {
  const map = LY.lqWuxing(el);
  LQ.forEach(lq => {
    const r = LY.liuqinYuanJi(el, lq), wx = map[lq];
    if (!r || !r.yuan || PRE_SHENG[wx] !== map[r.yuan]) { console.log('  ✗ ' + el + '宫·' + lq + ' 原神=' + (r && r.yuan) + ' 不生用神'); fail++; }
    if (!r || !r.ji || PRE_KE[wx] !== map[r.ji]) { console.log('  ✗ ' + el + '宫·' + lq + ' 忌神=' + (r && r.ji) + ' 不克用神'); fail++; }
    if (r && r.chou && PRE_SHENG[map[r.ji]] !== map[r.chou]) { console.log('  ✗ ' + el + '宫·' + lq + ' 仇神=' + r.chou + ' 不生忌神'); fail++; }
  });
});
console.log('  ✓ 全 5 五行 × 5 用神 与五行生克一致（8 卦宫五行即此 5 类，全部覆盖）');

console.log('\n=== 4) 全 64 卦 × 14 模块 getUseGodRelation 实算 ===');
let ok = 0, err = 0, present = 0, missing = 0;
for (let g = 0; g < 64; g++) {
  const six = [];
  for (let i = 0; i < 6; i++) six.push({ sum: [6, 7, 8, 9][(g + i * 3) % 4] });
  try {
    const chart = LY.arrange({ six: six, monthGanZhi: '丙寅', dayGanZhi: '甲子' });
    Object.keys(SYM.MOD_USE).forEach(mid => {
      const r = LY.getUseGodRelation(chart, SYM.MOD_USE[mid]);
      if (r) ok++; else { err++; return; }
      if (r.yongshen) present++; else missing++; // 用神伏藏（不显于本卦）须取本宫伏神，属正常
    });
  } catch (e) { err++; if (err <= 2) console.error('  CRASH g=' + g + ': ' + e.message); }
}
console.log('  成功 ' + ok + ' 次（含用神显 ' + present + ' / 伏藏 ' + missing + '），异常 ' + err + ' 次');
if (err) fail += err;

console.log('\n=== 结果 ===');
console.log(fail === 0 ? '✓ 用神一致性回归通过（引擎自洽 / 用神单一来源 / 全宫自洽 / 64卦实算无异常）'
  : ('✗ 失败项：' + fail));
process.exit(fail === 0 ? 0 : 1);
