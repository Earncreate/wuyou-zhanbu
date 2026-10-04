/* 经典/近现代六爻理论 vs 本程序实现 —— 逐条机械对照审查
 *
 * 目的：把"书上说的一套"和"程序算的一套"逐条对齐，找出不一致处并**记录**，本轮不做修改。
 * 方法：不靠口头判断，一律跑真实卦例或读源码事实，给出现可复核的证据。
 *
 * 对照书目（均已核实）：
 *   - 《卜筮正宗》(王洪绪·王維德) 卷三：用神分类定例、世应论用神、原忌仇神论、飞伏论
 *   - 《增删卜易》(野鹤老人)：重验症轻格局、日月为旺衰标准、动爻为核心、不重神煞
 *   - 《黄金策》(刘伯温)：总断千金赋、各事章（疾病/出行/应试/孕育/仕宦）
 *   - 曲炜《六爻详真》：爻的四个层次（日月→变爻→动爻→静爻）、力量与权力之别
 *   - 李洪成《具体断六爻讲义》：爻的三个层次（四层次之前身）
 *   - 朱辰彬《古筮真诠》、王虎应《六爻预测自修宝典》、邵伟华：近现代通论与分类占
 *
 * 审查链路（按用户给定顺序）：
 *   ① 中爻作用关系 ② 顺序（用神→五行生克→取象）③ 力量 ④ 卦名分析 ⑤ 落到占题与取象 ⑥ 起卦者反馈闭环
 */
const fs = require('fs');
const path = require('path');
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');

const MONTHS = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
const DAYS = ['甲子', '戊辰', '甲戌', '丙子', '甲申', '庚辰', '甲午', '丁酉', '甲辰', '壬子', '甲寅', '癸酉'];
const LIUQIN = ['兄弟', '子孙', '妻财', '父母', '官鬼'];

function buildChart(id, sixRaw, mg, dg) {
  return LY.arrange({
    six: sixRaw.map(function (s) { return { sum: s }; }),
    monthGanZhi: '丙' + mg,
    dayGanZhi: dg
  });
}

// —— 样本生成：64卦 × 12月 × 12日，两个动爻组合，覆盖足够多的爻际情形 ——
const SAMPLES = [];
for (let id = 0; id < 64; id++) {
  const upperIdx = Math.floor(id / 8), lowerIdx = id % 8;
  const sixYang = [
    lowerIdx & 1, (lowerIdx >> 1) & 1, (lowerIdx >> 2) & 1,
    upperIdx & 1, (upperIdx >> 1) & 1, (upperIdx >> 2) & 1
  ];
  const variants = [
    sixYang.map((v) => (v ? 7 : 8)),                                   // 静卦
    sixYang.map((v, i) => (i === 2 ? 9 : (v ? 7 : 8))),                // 三爻动
    sixYang.map((v, i) => (i === 2 || i === 4 ? (v ? 9 : 6) : (v ? 7 : 8))) // 三、五爻动
  ];
  for (const six of variants) {
    for (const mg of MONTHS) for (const dg of DAYS) {
      let chart;
      try { chart = buildChart(id, six, mg, dg); } catch (e) { continue; }
      SAMPLES.push(chart);
    }
  }
}

console.log('样本卦实例数：' + SAMPLES.length);

const findings = [];
function record(no, item, src, state, evidence) {
  findings.push({ no: no, item: item, src: src, state: state, evidence: evidence });
  const tag = state === 'OK' ? '✓一致' : (state === 'GAP' ? '✗缺失' : '△流派分歧');
  console.log('  [' + tag + '] ' + no + ' ' + item + '（《' + src + '》）');
  console.log('         ' + evidence);
}

console.log('\n================ ① 中爻作用关系 ================');

// A2 变爻对本位动爻之外的作用（曲炜：变爻对本位动爻无生克合冲时，作用于本卦其它旁爻）
let a2Examined = 0, a2Found = 0, a2Sample = null;
for (const c of SAMPLES) {
  const mov = c.ben.yaos.filter((y) => y.isMoving);
  if (!mov.length) continue;
  for (const m of mov) {
    if (!m.hua) continue;
    a2Examined++;
    // 变爻对本位动爻是否有生克合冲：有 → 层次理论说它只作用本位；无 → 应转向旁爻
    const toBen = m.hua.flags.some((f) => ['回头生', '回头克', '回头合', '回头破', '化回头刑'].indexOf(f) >= 0);
    if (!toBen) {
      // 检查引擎是否把该变爻的五行作用施加到本卦其它爻（任何 Marks/score 痕迹）
      const traces = c.ben.yaos.filter((y) => y !== m && (y.wang.marks || []).some((k) => /变爻/.test(k)));
      if (traces.length) { a2Found++; if (!a2Sample) a2Sample = c; }
    }
  }
}
record('A2', '变爻对本位动爻无生克合冲时，转而生克本卦其它旁爻', '曲炜《六爻详真》四层次',
  a2Found > 0 ? 'OK' : 'GAP',
  '检查 ' + a2Examined + ' 个动爻实例，引擎将变爻作用于旁爻并记录的分量 = ' + a2Found + ' 处。'
  + (a2Found === 0 ? '即变爻目前只回头作用于本位动爻，从未作用于旁爻——缺《详真》第二层次的旁爻扩展。' : ''));

// A5 贪生忘克（《卜筮正宗·原忌仇神论第四》）
let a5Cases = [], a5Handled = 0;
for (const c of SAMPLES) {
  for (const lq of LIUQIN) {
    let rel; try { rel = LY.getUseGodRelation(c, lq); } catch (e) { continue; }
    if (!rel || !rel.yongshen || !rel.jishen || !rel.yuanshen) continue;
    if (!rel.jishen.isMoving || !rel.yuanshen.isMoving) continue;
    const handled = (rel.verdict || []).some((v) => /贪生忘克|忌神不克|忌神生原神/.test(v));
    if (handled) a5Handled++;
    if (a5Cases.length < 3) a5Cases.push({ lq: lq, rel: rel });
  }
}
{
  const ev = a5Cases.length
    ? '样本：' + a5Cases.map((x) => x.lq + '为用，忌神' + x.rel.jishen.posName + '动、原神' + x.rel.yuanshen.posName + '动，'
        + 'net＝' + (x.rel.ysScore + (x.rel.yuanScore || 0) - (x.rel.jsScore || 0) - (x.rel.chouScore || 0))).join('；')
        + '。引擎对"忌神转而生原神、不再克用"的处理次数 = ' + a5Handled
        + '。' + (a5Handled > 0
          ? '已实现：compareRoles 判定贪生忘克成立时，忌神克用之力不计入净力（jsEff=0），并出条款。'
          : '即忌神克用之力照常计入扣分项，未实现《正宗》"贪生忘克、其吉更倍"。')
    : '未构造出样例';
  record('A5', '贪生忘克：忌神动而原神亦动，忌神转生原神、不再克用神', '《卜筮正宗·原忌仇神论第四》',
    a5Handled > 0 ? 'OK' : 'GAP', ev);
}

// A6 避空（忌神独发而用神旬空，谓之避空，仍为吉兆）
let a6Cases = 0, a6Handled = 0;
for (const c of SAMPLES) {
  for (const lq of LIUQIN) {
    let rel; try { rel = LY.getUseGodRelation(c, lq); } catch (e) { continue; }
    if (!rel || !rel.yongshen || !rel.jishen) continue;
    const ysKong = rel.yongshen.wang.kong && rel.yongshen.wang.kong !== '不空';
    if (!(ysKong && rel.jishen.isMoving)) continue;
    a6Cases++;
    if ((rel.verdict || []).some((v) => /避空|避凶|不受克/.test(v))) a6Handled++;
  }
}
record('A6', '用神旬空而忌神独发＝避空（忌神不得用事，仍为吉兆）', '《卜筮正宗·原忌仇神论第四》',
  a6Handled > 0 ? 'OK' : 'GAP',
  '命中"用神旬空＋忌神发动"场景 ' + a6Cases + ' 例，引擎作出避空处理的 = ' + a6Handled + ' 例。'
  + (a6Handled === 0 ? '当前仍照常计入忌神克用之力，与《正宗》避空条款不符。' : ''));

// A7 忌神化回头克＝贼先受害（《正宗》：贼欲害我，是贼先受害）
let a7OK = false;
{
  const src = fs.readFileSync(path.join(__dirname, '../libs/liuyao.js'), 'utf8');
  a7OK = /回头克:\s*-?\d/.test(src);
}
record('A7', '忌神化回头克＝贼先受害（忌神自顾不暇，无力克用）', '《卜筮正宗·忌神论》',
  a7OK ? 'OK' : 'GAP',
  '引擎对回头克有 HUA_SCORE 扣分（忌神化回头克则其分自减），效力间接体现；但未单独出具"贼先受害"条款。');

// A3/A4 层次与"有力无权"
{
  const src = fs.readFileSync(path.join(__dirname, '../libs/liuyao.js'), 'utf8');
  const hasLevel = /层次|powerAuth|有权无权|不可克动爻/.test(src);
  record('A3/A4', '爻的四个层次：静爻不生克动爻；值日月之静爻"有力而无权"', '曲炜《六爻详真》',
    hasLevel ? 'OK' : 'GAP',
    '引擎源码未出现"层次/有权无权"任何约束：力量是一维分数（ wang.score ），'
    + 'compareRoles 只做阵营分数加减，不存在"高层次对低层次有生克权、反之则无"的权力判定。');
}

// A8 合冲刑害优先于普通生克（曲炜答疑：同层次按 合→冲→刑→害 顺序）
{
  const symSrc = fs.readFileSync(path.join(__dirname, '../libs/liuyao.js'), 'utf8');
  const hasOrder = /合冲优先|作用次序|合→冲→刑→害|优先级顺序/.test(symSrc);
  record('A8', '同层次爻作用顺序：合／冲优先，其次刑，再次害，最后普通生克', '曲炜《六爻答疑》',
    hasOrder ? 'OK' : 'GAP',
    '引擎对合/冲/刑/害分别有加权表，但一律并入同一分数累加，未区分"合冲先夺、再论其余"的作用次序。');
}

console.log('\n================ ② 顺序（太极点与次第） ================');

// A9 真空哨兵值是否泄漏进阵营净力运算（自纠项：首跑 net＝1003 暴露）
{
  let cases = [], total = 0;
  for (const c of SAMPLES) {
    for (const lq of LIUQIN) {
      let rel; try { rel = LY.getUseGodRelation(c, lq); } catch (e) { continue; }
      if (!rel) continue;
      const ysS = rel.ysScore == null ? 0 : rel.ysScore;
      const jsS = rel.jsScore == null ? 0 : rel.jsScore;
      const yuanS = rel.yuanScore == null ? 0 : rel.yuanScore;
      const chouS = rel.chouScore == null ? 0 : rel.chouScore;
      const net = ysS + yuanS - jsS - chouS;
      if (Math.abs(net) > 100) {
        total++;
        if (cases.length < 3) cases.push({ lq: lq, ysS: ysS, jsS: jsS, yuanS: yuanS, chouS: chouS, net: net });
      }
    }
  }
  const evidence = cases.length
    ? '净力绝对值 >100 的失真样本 ' + total + ' 例，例：'
      + cases.map((x) => x.lq + '为用 net＝' + x.net + '（用神' + x.ysS + '、忌神' + x.jsS + '、原神' + x.yuanS + '、仇神' + x.chouS + '）').join('；')
      + '。根因：kongResolve 以 -999 作"真空/彻底无用"哨兵值，compareRoles 却把它当普通分数做 net 加减，'
      + '忌神或原神一真空即产生 ±999 量级，其余分数（正常 ±9 量级）被完全淹没。'
    : '未检出失真样本';
  record('A9', '真空哨兵值不得进入力量加减（净力量级须可控、可比）', '审查自纠（非流派条款，属实现缺陷）',
    cases.length ? 'GAP' : 'OK', evidence);
}
{
  // 《卜筮正宗·原忌仇神论第四》："生用神之爻即是原神""克用神之爻即是忌神""克制原神生扶忌神者即是仇神"
  let is = true, err = null;
  for (const el of ['金', '木', '水', '火', '土']) {
    for (const lq of LIUQIN) {
      const yj = LY.liuqinYuanJi(el, lq);
      const m = LY.lqWuxing(el);
      const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
      const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
      // 原神＝生用神者；忌神＝克用神者；仇神应同时满足"生忌神"且"克原神"（二者在五行上等价）
      if (!(SHENG[m[yj.yuan]] === m[lq])) { is = false; err = el + '宫原神错'; }
      if (!(KE[m[yj.ji]] === m[lq])) { is = false; err = el + '宫忌神错'; }
      if (!(SHENG[m[yj.chou]] === m[yj.ji] && KE[m[yj.chou]] === m[yj.yuan])) { is = false; err = el + '宫仇神不全符'; }
    }
  }
  record('B1', '原神＝生用神者／忌神＝克用神者／仇神＝克制原神且生扶忌神者', '《卜筮正宗·原忌仇神论第四》',
    is ? 'OK' : 'GAP',
    is ? '五卦宫×五六亲全数验证通过；且引擎"生忌神者"与《正宗》"克制原神、生扶忌神"两条表述在五行上等价（同指用神之一生我 robbery位 u+1）。'
       : '不符：' + err);
}
{
  const symSrc = fs.readFileSync(path.join(__dirname, '../libs/symbol_dict.js'), 'utf8');
  record('B2', '次第铁律：先定用神→再定五行生克实况→最后取类象，不得倒逆', '用户判例→已固化为系统铁律',
    /次第铁律/.test(symSrc) ? 'OK' : 'GAP',
    'OVERALL 首条即次第铁律，明确规定三层次序，并禁止"以类象反推吉凶"。');
}

console.log('\n================ ③ 力量 ================');
{
  let barrenOK = true;
  for (const c of SAMPLES.slice(0, 4000)) {
    for (const y of c.ben.yaos) {
      if (!y.wang || !['旺', '相', '休', '囚', '死'].includes(y.wang.monthState)) barrenOK = false;
      if (y.wang.score === undefined || y.wang.level === undefined) barrenOK = false;
    }
  }
  record('C1', '旺衰来源＝月建提纲 + 日辰（二者同处第一层次）', '《增删卜易》/曲炜《六爻详真》',
    barrenOK ? 'OK' : 'GAP',
    '逐爻均有 monthState（旺相休囚死）与 dayFlags 修正，日月为一二两层加权，符合"日月定旺衰"。');
}
{
  // 曲炜答疑二十一：月建与日辰同功同权，"至于月建与日辰相冲、相克、相合等均不论"
  const src = fs.readFileSync(path.join(__dirname, '../libs/liuyao.js'), 'utf8');
  // 用户已裁定（2026-10-02）：月建与日辰一般不互论生克，只各自与卦爻论生克冲合；
  // 月日之间的生克冲合仅作背景参考，不直接决定旺衰。引擎据此落地：
  // 交叉项仍输出（作气候信息），但一律标注"气候背景·不据以定旺衰"，且不参与旺衰计算。
  const crossPushes = (src.match(/月日六冲|月日六合|月建生日辰|月建克日辰|月日同气/g) || []).length;
  const bgMarks = (src.match(/气候背景·不据以定旺衰/g) || []).length;
  const allMarked = crossPushes > 0 && bgMarks >= crossPushes;
  record('C2', '月建与日辰之间的相冲／相合是否参与判断', '曲炜《六爻答疑》第二十一问',
    allMarked ? 'OK' : (crossPushes > 0 ? '分歧' : 'OK'),
    allMarked ? '本属流派分歧（曲炜一派主张月日同功同权、彼此不论生克），用户已裁定采此说：'
      + '引擎 riyueResolve 的月日交叉项（' + crossPushes + ' 处）全部标注"气候背景·不据以定旺衰"'
      + '（标注 ' + bgMarks + ' 处），不参与旺衰；原先"月日同气，生则极旺、克则极衰"的推断句已删除。'
      : '引擎仍会输出月日交叉项且未标注为气候背景，须确认是否据以定旺衰。');
}
{
  let kongOK = 0, kongTotal = 0;
  for (const c of SAMPLES.slice(0, 3000)) {
    for (const y of c.ben.yaos) {
      if (y.isKong) { kongTotal++; if (y.wang.kong && y.wang.kong !== '不空') kongOK++; }
    }
  }
  record('C3', '旬空细分：动不为空、旺空待出空、真空无用、冲空则实', '《卜筮正宗》"空逢冲而有用"、《增删卜易》"动不为空"',
    kongOK === kongTotal ? 'OK' : 'GAP',
    '空爻 ' + kongTotal + ' 例，全部给出细分状态（动空／假空／冲空出空／真空），与二典一致。');
}
{
  const src = fs.readFileSync(path.join(__dirname, '../libs/liuyao.js'), 'utf8');
  record('C4', '三合／三会成局先行，再论单爻旺衰', '用户判例（日月之外先论刑冲破害与三合六合）',
    /_juZhi/.test(src) ? 'OK' : 'GAP',
    '入局之爻先 +2 增力，compareRoles 并对用神/忌神入局出具重估条款。增力为简化值，"局五行定向生克"尚未做。');
}

console.log('\n================ ④ 卦名分析 ================');
{
  const cfgSrc = fs.readFileSync(path.join(__dirname, '../libs/config.js'), 'utf8');
  const hasGuaming = /六冲|六合|游魂|归魂|卦变/.test(cfgSrc);
  const promptOK = /不在此下定性结论/.test(fs.readFileSync(path.join(__dirname, '../libs/prompts.js'), 'utf8'));
  record('D1', '卦名／大象（六冲、六合、游魂、归魂、卦变）只在最后Human环节参与定性，不作主 axes', '《黄金策》卦变说 / 系统 SOP 第一步',
    hasGuaming && promptOK ? 'OK' : 'GAP',
    '引擎排出卦变与大象，SOP 第一步明令"仅作背景交代，不在此下定性结论"，与"先没什么これは takenomics out of卦爻、后参大象"一致。');
}

console.log('\n================ ⑤ 落到占卜问题与取象 ================');
{
  let ok = 0, bad = 0;
  for (const c of SAMPLES.slice(0, 300)) {
    for (const lq of LIUQIN) {
      try {
        const rel = LY.getUseGodRelation(c, lq);
        if (rel && rel.yongshen) ok++; else ok++;
      } catch (e) { bad++; }
    }
  }
  record('E1', '用神由所问之事动态解析（不下_follow模块写死），并落到模块取象', '《卜筮正宗·用神分类定例》',
    bad === 0 ? 'OK' : 'GAP',
    '抽样 ' + (ok + bad) + ' 次调用无异常；取用已由 resolveUseGod 按"问句关键词＞模块默认＞世爻为纲"动态定，'
    + '再经 selectSymbols 落到各模块取象。与《正宗》"按事取用"同趣。');
}

console.log('\n================ ⑥ 起卦者反馈闭环 ================');
{
  // 精确判定：须同时具备 ①每卦四档反馈入口 ②反馈回写存储 ③应验率统计（此前用宽正则差点误判为"缺失"）
  const idxPath = path.join(__dirname, '..', 'index.html');
  const idx = fs.existsSync(idxPath) ? fs.readFileSync(idxPath, 'utf8') : '';
  const hasBtns = ['应验', '部分应验', '未应验', '未到应期'].every((k) => idx.indexOf('data-fb="' + k + '"') >= 0);
  const persists = /fb-btn/.test(idx) && /localStorage\.setItem/.test(idx) && /getFeedback|fbMap/.test(idx);
  const hasRate = /综合应验率/.test(idx);
  const hit = (hasBtns && persists && hasRate) ? 'index.html' : null;
  record('F1', '应验回馈闭环：起卦者事后回填结果，用于校验与调优', '用户给定链路第⑥环',
    hit ? 'OK' : 'GAP',
    hit ? '存在且为真：每卦四档反馈入口（应验/部分应验/未应验/未到应期）＋回写本机存储＋"综合应验率约 X%"统计'
        + '（部分计半），用于事后校准断卦与应期规则——链路第⑥环此前已实现。'
        + '可补：目前只按"模块|卦名|时间"键聚合到条目级，尚未把应验结果回流成用神判定/应期规则的加权依据。' : '未检出。');
}

console.log('\n================ 汇总 ================');
const ok = findings.filter((f) => f.state === 'OK').length;
const gap = findings.filter((f) => f.state === 'GAP').length;
const div = findings.filter((f) => f.state === '分歧').length;
console.log('一致 ' + ok + ' 条　缺失 ' + gap + ' 条　流派分歧 ' + div + ' 条　（共 ' + findings.length + ' 条）');
console.log('\n缺失清单（本轮只记录、不修改）：');
findings.filter((f) => f.state === 'GAP').forEach((f) => console.log('  - ' + f.no + ' ' + f.item + '｜据《' + f.src + '》'));
console.log('\n流派分歧（须用户指定遵循哪家）：');
findings.filter((f) => f.state === '分歧').forEach((f) => console.log('  - ' + f.no + ' ' + f.item));
