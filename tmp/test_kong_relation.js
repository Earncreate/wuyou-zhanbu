/* 专项回归：空亡量化修复 + 贪生忘克 + 避空
 * 覆盖本轮三处引擎改动：
 *   ① A9 真空哨兵值不再污染净力（量级可控）
 *   ② A5 贪生忘克：忌神动＋原神动 → 忌神不计入克用
 *   ③ A6 避空：用神旬空＋忌神独发 → 忌神不得用事
 */
const LY = require('../libs/liuyao.js');

const MONTHS = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
const DAYS = ['甲子', '戊辰', '甲戌', '丙子', '甲申', '庚辰', '甲午', '丁酉', '甲辰', '壬子', '甲寅', '癸酉'];
const LIUQIN = ['兄弟', '子孙', '妻财', '父母', '官鬼'];

const charts = [];
for (let id = 0; id < 64; id++) {
  const up = Math.floor(id / 8), lo = id % 8;
  const y = [lo & 1, (lo >> 1) & 1, (lo >> 2) & 1, up & 1, (up >> 1) & 1, (up >> 2) & 1];
  // 三组变体：静卦 / 单动爻 / 双动爻（贪生忘克须忌神与原神同时发动，故必须有双动爻样本）
  for (const six of [y.map((v) => (v ? 7 : 8)),
                     y.map((v, i) => (i === 2 ? 9 : (v ? 7 : 8))),
                     y.map((v, i) => (i === 2 || i === 4 ? (v ? 9 : 6) : (v ? 7 : 8)))]) {
    for (const mg of MONTHS) for (const dg of DAYS) {
      try { charts.push(LY.arrange({ six: six.map((s) => ({ sum: s })), monthGanZhi: '丙' + mg, dayGanZhi: dg })); } catch (e) {}
    }
  }
}

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name + (extra ? '　' + extra : '')); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '　' + extra : '')); }
}
function netOf(rel) {
  return rel.ysScore + (rel.yuanScore || 0) - (rel.jsScore || 0) - (rel.chouScore || 0);
}
// 净力以引擎实际裁决文字为准（jsScore 字段是原始分，剔除忌神只体现在裁决的净力里）
function netFromVerdict(rel) {
  const v = (rel.verdict || []).find((x) => /阵营净力/.test(x));
  if (!v) return null;
  const m = v.match(/＝\s*(-?\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

console.log('样本 ' + charts.length + ' 例\n');

console.log('=== ① A9 真空哨兵值不再污染净力 ===');
{
  let maxAbs = 0, vacuumYao = 0, badScore = 0, badLevel = 0;
  for (const c of charts) for (const lq of LIUQIN) {
    let rel; try { rel = LY.getUseGodRelation(c, lq); } catch (e) { continue; }
    if (!rel) continue;
    const n = netOf(rel);
    if (Math.abs(n) > Math.abs(maxAbs)) maxAbs = n;
    if (rel.yongshen && rel.yongshen.wang && rel.yongshen.wang.kong === '真空') {
      vacuumYao++;
      if (rel.ysScore !== 0) badScore++;
      if (!/真空/.test(rel.yongshen.wang.level)) badLevel++;
    }
  }
  ck('净力量级可控（|net| 最大 ' + maxAbs + '，修复前可达 ±999）', Math.abs(maxAbs) < 40);
  ck('真空用神力量按零计（' + vacuumYao + ' 例，违例 ' + badScore + '）', vacuumYao > 0 && badScore === 0);
  ck('真空用神 level 标注为真空（违例 ' + badLevel + '）', vacuumYao > 0 && badLevel === 0);
}

console.log('\n=== ② 贪生忘克：忌神动＋原神动 → 忌神不克用 ===');
{
  let found = 0, noteOK = 0, sunkOK = 0, noWorse = 0, cmpN = 0;
  for (const c of charts) for (const lq of LIUQIN) {
    // 用神须先传给引擎，爻际量化（含忌神不得用事的下沉）才生效；applyInterYao 幂等可反复重算
    if (!LY.applyInterYao(c, lq)) continue;
    let rel; try { rel = LY.getUseGodRelation(c, lq); } catch (e) { continue; }
    if (!rel || !rel.jishen || !rel.yuanshen || !rel.yongshen) continue;
    if (!rel.jishen.isMoving || !rel.yuanshen.isMoving) continue;
    found++;
    // 用神旬空且原神同动时，避空与贪生忘克同时成立，引擎按避空优先出条款（结论方向一致：忌神均不克用）
    const hasNote = (rel.verdict || []).some((v) => /贪生忘克|避空/.test(v));
    if (hasNote) noteOK++;
    // 【下沉校验】避空／贪生忘克此前只是提示词条款（模型采信率 0）；爻际量化层建起后
    // 已下沉为数字——关掉 relationRules 重算，用神分应回落（忌神恢复克用），
    // 且绝不会出现"关掉反而更高"的情形。这才是"绕不开"的硬证据。
    const on = rel.ysScore;
    LY.setAblation({ relationRules: false });
    LY.applyInterYao(c, lq);
    const off = LY.getUseGodRelation(c, lq);
    LY.setAblation({ relationRules: true });
    LY.applyInterYao(c, lq);
    if (!off) continue;
    // 只比较同一爻：用神分变化会改变"六亲两现"的取舍（pick 以旺衰排序），
    // 两次可能选中不同爻，跨爻比较没有意义
    if (!on || !off.yongshen || !rel.yongshen) continue;
    if (off.yongshen.posName !== rel.yongshen.posName) continue;
    cmpN++;
    if (on >= off.ysScore) noWorse++;
    if (hasNote && on > off.ysScore) sunkOK++;
  }
  ck('命中场景 ' + found + ' 例，出具条款 ' + noteOK + ' 例（避空优先或贪生忘克）', found > 0 && noteOK === found);
  ck('忌神克用已下沉为数字：可比 ' + cmpN + ' 例中，关条款后用神分回落 ' + sunkOK + '、无一例反向 ' + noWorse,
    cmpN > 0 && sunkOK > 0 && noWorse === cmpN);
}

console.log('\n=== ③ 避空：用神旬空＋忌神独发 → 忌神不得用事 ===');
{
  let found = 0, noteOK = 0, sunkOK = 0, noWorse = 0, cmpN = 0;
  for (const c of charts) for (const lq of LIUQIN) {
    if (!LY.applyInterYao(c, lq)) continue;
    let rel; try { rel = LY.getUseGodRelation(c, lq); } catch (e) { continue; }
    if (!rel || !rel.jishen || !rel.yongshen) continue;
    const kong = rel.yongshen.isKong && rel.yongshen.wang ? rel.yongshen.wang.kong : '不空';
    if (kong === '不空' || !rel.jishen.isMoving) continue;
    found++;
    if ((rel.verdict || []).some((v) => /避空/.test(v))) noteOK++;
    // 同 ②：避空已下沉为数字——关掉条款重算，用神分应回落（忌神恢复克用）
    const on = rel.ysScore;
    LY.setAblation({ relationRules: false });
    LY.applyInterYao(c, lq);
    const off = LY.getUseGodRelation(c, lq);
    LY.setAblation({ relationRules: true });
    LY.applyInterYao(c, lq);
    if (!off) continue;
    // 只比较同一爻（同上：用神分变化会改变六亲两现的取舍）
    if (!on || !off.yongshen || !rel.yongshen) continue;
    if (off.yongshen.posName !== rel.yongshen.posName) continue;
    cmpN++;
    if (on >= off.ysScore) noWorse++;
    if (on > off.ysScore) sunkOK++;
  }
  ck('命中场景 ' + found + ' 例，出具"避空"条款 ' + noteOK + ' 例', found > 0 && noteOK === found);
  ck('避空已下沉为数字：可比 ' + cmpN + ' 例中，关条款后用神分回落 ' + sunkOK + '、无一例反向 ' + noWorse,
    cmpN > 0 && sunkOK > 0 && noWorse === cmpN);
}

console.log('\n=== ④ 忌神宜空（空则不为害） ===');
{
  let found = 0, noteOK = 0;
  for (const c of charts) for (const lq of LIUQIN) {
    let rel; try { rel = LY.getUseGodRelation(c, lq); } catch (e) { continue; }
    if (!rel || !rel.jishen) continue;
    if (!rel.yongshen) continue; // 用神伏神时 compareRoles 裁决块整体不执行，属预期
    if (!(rel.jishen.isKong && rel.jishen.wang && rel.jishen.wang.kong === '真空')) continue;
    found++;
    if ((rel.verdict || []).some((v) => /忌神真空/.test(v))) noteOK++;
  }
  ck('忌神真空 ' + found + ' 例，出具"忌神宜空反主吉"条款 ' + noteOK + ' 例', found === 0 || noteOK === found);
}

console.log('\n结果：通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail === 0 ? 0 : 1);
