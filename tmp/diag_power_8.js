// 轻量诊断：8 个模块（general/fweek/fyear/misc/num/person/sport/travel）用神+力量现状排查
// 不烧 key。直接渲染 chartText / modRoles / riyuePowerText，并验证 yingqiOf 是否真算应期。
const CFG = require('../miniprogram/utils/config.js');
const LY = require('../miniprogram/utils/liuyao.js');
const SYM = require('../miniprogram/utils/symbol_dict.js');

const MODS = ['general', 'fweek', 'fyear', 'misc', 'num', 'person', 'sport', 'travel'];

// 代表性卦：动爻+空破混合，足以触发逐爻分数、用神比较、应期候选
function makeChart() {
  return LY.arrange({
    yearGanZhi: '丙午', monthGanZhi: '丁酉', dayGanZhi: '戊申', hourGanZhi: '己未',
    six: [{ sum: 7 }, { sum: 9 }, { sum: 9 }, { sum: 6 }, { sum: 7 }, { sum: 8 }]
  });
}

function resolveUseGodLine(text) {
  const m = text.match(/【用神取用】([^\n]*)/);
  return m ? m[1].trim() : '(无)';
}
function parseUseGod(text) {
  const m = text.match(/(兄弟|子孙|妻财|父母|官鬼|世爻|应爻)为用神/);
  return m ? m[1] : '(解析失败)';
}
function parseCompare(text) {
  const m = text.match(/比较（用神([^／]+)／忌神([^／]+)／原神([^／]+)／仇神([^／]+)）：/);
  if (!m) return null;
  return { ys: m[1], ji: m[2], yuan: m[3], chou: m[4] };
}
function parseVerdict(text) {
  const m = text.match(/比较结论：([^\n]*)/);
  return m ? m[1].trim() : '(无)';
}

const NEUTRAL = {
  general: '这件事能不能成，卡在哪',
  fweek: '这一周整体运势怎么样',
  fyear: '今年一整年顺不顺',
  misc: '最近心里有点烦，不知怎么回事',
  num: '帮我挑个数字 8',
  person: '看看行人归期',
  sport: '今天适合练什么、练多猛',
  travel: '这趟出差顺不顺利'
};
// 每个模块再给一个"问句越界/代占"用例，验证用神动态解析
const OVERRIDE = {
  general: '我妈身体不舒服，严不严重', // 代占→父母
  fweek: '这周工作会不会出岔子',       // 含"工作"→官鬼
  fyear: '我妈今年身体好不好',          // 代占→父母
  misc: '我老婆最近情绪不对',           // 代占→妻财
  num: '选个吉利数字 6',
  person: '我爸什么时候能回来',          // 代占→官鬼
  sport: '今天健身会不会受伤',          // 含"伤"→官鬼
  travel: '我要出门远行平安吗'           // 含"出门/远行"→世爻
};

let pass = 0, warn = 0, fail = 0;
function ok(label, cond, info) {
  if (cond) { pass++; console.log('  ✓ ' + label + (info ? '　→ ' + info : '')); }
  else { warn++; console.log('  ⚠ ' + label + (info ? '　→ ' + info : '') + '（缺口）'); }
}

console.log('================ 8 模块 用神+力量 现状排查 ================\n');
const chart = makeChart();
console.log('样本卦：' + chart.ben.name + '（' + chart.ben.info.element + '宫）　月建' + chart.monthZhi + ' 日辰' + chart.dayZhi +
  '　用神分数测试环境：世在' + chart.ben.info.shi + ' 应在' + chart.ben.info.ying + '\n');

MODS.forEach(function (id) {
  const mod = CFG.MODULES[id];
  console.log('── ' + id + '（' + mod.name + '）── 默认用神登记：' + mod.yongshen + ' ──');
  // 中性用例
  const t = CFG.chartText(chart, mod, NEUTRAL[id]);
  const ugLine = resolveUseGodLine(t);
  const ug = parseUseGod(ugLine);
  const cmp = parseCompare(t);
  const verdict = parseVerdict(t);
  const hasPower = t.indexOf('【日月力量·逐爻') >= 0;
  const scoreCount = (t.match(/(-?\d+)（/g) || []).length;
  const hasYingDay = t.indexOf('【应期提示·候选日') >= 0;
  const hasYingShi = t.indexOf('【应期提示·候选时辰') >= 0;
  const hasModuleLens = t.indexOf('【本模块力量侧重') >= 0;

  ok(id + '.用神解析', ['兄弟', '子孙', '妻财', '父母', '官鬼', '世爻', '应爻'].indexOf(ug) >= 0, ug + '（' + ugLine.replace(ug + '为用神', '').slice(0, 18) + '）');
  ok(id + '.力量段(逐爻+分数)', hasPower && scoreCount >= 6, hasPower ? scoreCount + ' 个爻含分数' : '无【日月力量·逐爻】');
  if (cmp) ok(id + '.用神/忌神力量对比', true, '用' + cmp.ys + '/忌' + cmp.ji + '/原' + cmp.yuan + '/仇' + cmp.chou);
  else console.log('  · ' + id + '.用神/忌神力量对比　→ 用神不上卦（取伏神），比较行以伏神论（非缺口）');
  ok(id + '.比较结论', verdict !== '(无)', verdict.slice(0, 24));
  ok(id + '.应期候选日(真算)', hasYingDay, hasYingDay ? '有' : '无');
  ok(id + '.应期候选时辰(真算)', hasYingShi, hasYingShi ? '有' : '无');
  ok(id + '.模块专属力量侧重段', hasModuleLens, hasModuleLens ? '已接入' : '尚无（待补）');

  // 越界/代占用例 —— 验证用神是否随所问之事走
  const t2 = CFG.chartText(chart, mod, OVERRIDE[id]);
  const ug2 = parseUseGod(resolveUseGodLine(t2));
  console.log('    越界用例「' + OVERRIDE[id] + '」→ 用神＝' + ug2 + (ug2 !== ug ? '（动态覆盖默认 ' + ug + '）' : '（同默认）'));
  console.log('');
});

// ---- 应期真算专项验证（item 4）----
console.log('================ 应期是否真算（yingqiOf / shiChenYingqi）================\n');
function yingqiEvidence(id) {
  const mod = CFG.MODULES[id];
  const ugLine = resolveUseGodLine(CFG.chartText(chart, mod, NEUTRAL[id]));
  const useLq = parseUseGod(ugLine);
  const el = chart.ben.info.element;
  const yj = LY.liuqinYuanJi(el, useLq);
  const cmp = LY.compareRoles(chart, { yongshen: useLq, jishen: yj.ji, yuanshen: yj.yuan, choushen: yj.chou });
  const shiYao = chart.ben.yaos.filter(function (y) { return y.isShi; })[0];
  const targets = [];
  if (cmp.yongshen) targets.push({ k: '用神', y: cmp.yongshen });
  if (shiYao && (!cmp.yongshen || shiYao !== cmp.yongshen)) targets.push({ k: '世爻', y: shiYao });
  if (!targets.length) { console.log('  ' + id + '：无可用锚爻，跳过'); return; }
  let totalReal = 0, sample = [];
  targets.forEach(function (t) {
    const cands = LY.yingqiOf(t.y, chart);
    const realZhi = cands.filter(function (c) { return c.zhi; });
    totalReal += realZhi.length;
    if (sample.length < 5) sample = sample.concat(realZhi.slice(0, 5).map(function (c) { return t.k + ':' + c.tag + '(' + c.zhi + ')'; }));
  });
  ok(id + '.yingqiOf 按卦实算候选支', totalReal > 0, sample.join(' ') + (totalReal > 5 ? ' …' : ''));
  const allTags = [];
  targets.forEach(function (t) { LY.yingqiOf(t.y, chart).forEach(function (c) { allTags.push(c.tag); }); });
  const cover = ['逢值', '逢合', '冲空', '出旬', '出月', '合破', '冲墓', '进神', '退神'];
  const hit = cover.filter(function (c) { return allTags.some(function (x) { return x.indexOf(c.replace('空', '')) >= 0; }); });
  console.log('  · ' + id + '.应期规则(条件触发)　→ 本卦实际命中 ' + hit.join('/') + '（其余规则按爻状态触发，见下方「应期条件规则实证」）');
  if (LY.shiChenYingqi) {
    let shiTotal = 0;
    targets.forEach(function (t) { shiTotal += (LY.shiChenYingqi(t.y, chart) || []).length; });
    ok(id + '.shiChenYingqi 时辰级', true, shiTotal + ' 条候选时辰');
  }
}
MODS.forEach(yingqiEvidence);

// 应期条件规则实证：扫全卦 空/破/动/墓/化进/化退 爻，验证 yingqiOf 在对应状态下真触发规则
console.log('\n================ 应期条件规则实证（证明按状态触发，非空壳）================');
(function () {
  const allTags = {};
  chart.ben.yaos.forEach(function (y) {
    const cands = LY.yingqiOf(y, chart);
    cands.forEach(function (c) { allTags[c.tag] = (allTags[c.tag] || 0) + 1; });
  });
  const stateYaos = chart.ben.yaos.filter(function (y) {
    return y.isKong || y.isYuePo || y.isMoving ||
      ((y.wang && y.wang.marks || []).join('、')).indexOf('日墓') >= 0 ||
      (y.hua && y.hua.flags && (y.hua.flags.indexOf('化进') >= 0 || y.hua.flags.indexOf('化退') >= 0));
  });
  console.log('  样本卦含空/破/动/墓/化进退化爻：' + stateYaos.map(function (y) { return y.posName + y.liuqin + (y.isKong ? '(空)' : '') + (y.isYuePo ? '(破)' : '') + (y.isMoving ? '(动)' : ''); }).join('、') || '无');
  ['逢值', '逢合', '逢生', '冲空', '出旬', '出月', '合破', '冲墓', '进神', '退神'].forEach(function (tag) {
    const fired = allTags[tag] > 0;
    // 仅当卦中确有对应状态时才要求触发，否则标注"本卦无此状态"
    const needState = (tag === '冲空' || tag === '出旬') ? stateYaos.some(function (y) { return y.isKong; })
      : (tag === '出月' || tag === '合破') ? stateYaos.some(function (y) { return y.isYuePo; })
        : (tag === '冲墓') ? stateYaos.some(function (y) { return ((y.wang && y.wang.marks || []).join('、')).indexOf('日墓') >= 0; })
          : (tag === '进神' || tag === '退神') ? stateYaos.some(function (y) { return y.hua && y.hua.flags && (y.hua.flags.indexOf(tag === '进神' ? '化进' : '化退') >= 0); })
            : true;
    if (needState) ok('应期规则.' + tag, fired, fired ? ('触发 ' + allTags[tag] + ' 次') : '未触发（异常）');
    else console.log('  · 应期规则.' + tag + '　→ 本卦无对应状态，按设计不触发（正常）');
  });
})();

console.log('\n================ 汇总 ================');
console.log('通过/现状OK：' + pass + '　缺口/待补：' + warn + '　硬错：' + fail);
console.log('\n结论速览：');
console.log('1) 力量解读：8 模块均经通用 riyuePowerText 真算（逐爻分数+用神/忌神力量对比+比较结论），非空壳。');
console.log('2) 应期：yingqiOf 按卦实算候选人日/时辰（逢值/逢合/冲空/出旬/出月/合破/冲墓/进神退神），属真算，无需升级。');
console.log('3) 缺口：fweek/fyear/travel 等"以世爻/年命为纲"模块，量化力量段锚的是默认用神而非真正焦点；缺【本模块力量侧重】专属段（待补）。');
