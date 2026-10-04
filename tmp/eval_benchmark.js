// 卦例评测基准（带标准答案）：无忧占卜·用神动态解析 + 力量/应期引擎一致性校验
// 不烧 key。标准答案冻结于 2026-10-02（引擎含 modulePowerText + 官鬼关键词补"伤"之后）。
// 用途：① 回归护栏——用神解析/吉凶方向/应期方向不得漂移；② AI 总断评测基准——AI 输出须对齐 verdict+note。
const CFG = require('../miniprogram/utils/config.js');
const LY = require('../miniprogram/utils/liuyao.js');

// A=用神旺相(吉向)  B=用神休囚空破(凶向)，覆盖吉凶两态
const CHARTS = {
  A: { yearGanZhi: '丙午', monthGanZhi: '丁酉', dayGanZhi: '戊申', hourGanZhi: '己未', six: [{ sum: 7 }, { sum: 9 }, { sum: 9 }, { sum: 6 }, { sum: 7 }, { sum: 8 }] },
  B: { yearGanZhi: '甲辰', monthGanZhi: '庚午', dayGanZhi: '壬子', hourGanZhi: '庚子', six: [{ sum: 8 }, { sum: 6 }, { sum: 8 }, { sum: 7 }, { sum: 8 }, { sum: 7 }] }
};

// 标准答案：useGod=引擎按经典规则解析的用神；verdict=比较结论方向(吉/凶/两可)；ying=应期候选规则集(非空即可)
const BENCH = [
  { mod: 'general', chart: 'A', q: '我妈身体不舒服严不严重', useGod: '父母', source: '代占', verdict: '两可',
    note: '代占：问病非自身，以对方六亲「父母」为体（经典代占取用），官鬼(病象)为辅；世爻退为问卦人位，不得改立官鬼为用神' },
  { mod: 'general', chart: 'A', q: '这笔投资能回本吗', useGod: '妻财', source: '问句', verdict: '吉',
    note: '投资属财，问句命中妻财；财旺(得生)主可回本' },
  { mod: 'fweek', chart: 'A', q: '这周工作会不会出岔子', useGod: '官鬼', source: '问句', verdict: '凶',
    note: '工作→官鬼(职位压力)；本卦官鬼极衰且空，主本周工作易出岔子/耗损' },
  { mod: 'fweek', chart: 'A', q: '本周整体运势怎么样', useGod: '子孙', source: '世爻', verdict: '吉',
    note: '中性周运以世爻为纲→世爻所临六亲(子孙)为体；世爻旺相主整周顺' },
  { mod: 'fyear', chart: 'A', q: '今年一整年顺不顺', useGod: '子孙', source: '世爻', verdict: '吉',
    note: '年运以世爻为全年基调→世爻所临六亲(子孙)；世旺主全年顺（填出生年另立年命根基）' },
  { mod: 'misc', chart: 'A', q: '我老婆最近情绪不对', useGod: '妻财', source: '代占', verdict: '吉',
    note: '代占：配偶→妻财为体；妻财旺主情绪面无大碍' },
  { mod: 'num', chart: 'A', q: '选个吉利数字6', useGod: '子孙', source: '世爻', verdict: '吉',
    note: '数字占以世爻为纲→世爻所临六亲(子孙)；旺相偏吉（趣味推演，不构成决策依据）' },
  { mod: 'person', chart: 'A', q: '我爸什么时候能回来', useGod: '父母', source: '代占', verdict: '两可',
    note: '代占：父亲→父母为体（切太极点）；父母不上卦/伏神则归期迟滞，须看动静与应期' },
  { mod: 'person', chart: 'A', q: '我儿子什么时候回来', useGod: '子孙', source: '代占', verdict: '吉',
    note: '代占：子女→子孙为体；子孙旺相应人已动身或近期可归' },
  { mod: 'sport', chart: 'A', q: '今天健身会不会受伤', useGod: '官鬼', source: '问句', verdict: '凶',
    note: '受伤→官鬼(伤病/伤灾，关键词补"伤"后命中)；本卦官鬼极衰且空，主宜降强度防伤' },
  { mod: 'sport', chart: 'A', q: '今天适合练什么练多猛', useGod: '子孙', source: '模块', verdict: '吉',
    note: '运动占默认用神子孙(舒展释放)；子孙旺相可放开练、强度可维持' },
  { mod: 'travel', chart: 'A', q: '我要出门远行平安吗', useGod: '子孙', source: '世爻', verdict: '吉',
    note: '出行以世爻为体→归一化为世爻所临六亲(本卦子孙)；平安基调看世爻旺衰，官鬼发动主凶险' },
  { mod: 'travel', chart: 'A', q: '这趟出差顺不顺利', useGod: '妻财', source: '模块', verdict: '吉',
    note: '中性出行回落模块默认妻财(所问之行程/资费)；财旺主顺' },
  { mod: 'general', chart: 'B', q: '问这事能不能成', useGod: '兄弟', source: '世爻', verdict: '吉',
    note: '通用中性问句以世爻为纲→本卦世爻所临六亲(兄弟)；旺相主可成' },
  { mod: 'wealth', chart: 'B', q: '这笔钱能拿回来吗', useGod: '妻财', source: '问句', verdict: '吉',
    note: '讨债属财→妻财；本卦妻财旺相主可拿回' },
  { mod: 'illness', chart: 'B', q: '我这病啥时候好', useGod: '官鬼', source: '问句', verdict: '吉',
    note: '问病→官鬼(病体)；本卦官鬼旺相、子孙(医药)有力主可愈，应期看退神/受制之日' }
];

function verdictDir(t) {
  if (t.indexOf('吉象') >= 0) return '吉';
  if (t.indexOf('凶象') >= 0) return '凶';
  return '两可';
}
function yingTags(chart, useLq) {
  const el = chart.ben.info.element;
  const yj = LY.liuqinYuanJi(el, useLq);
  const cmp = LY.compareRoles(chart, { yongshen: useLq, jishen: yj.ji, yuanshen: yj.yuan, choushen: yj.chou });
  const tags = [];
  const pushY = function (y) { if (!y) return; LY.yingqiOf(y, chart).forEach(function (c) { if (tags.indexOf(c.tag) < 0) tags.push(c.tag); }); };
  pushY(cmp.yongshen); pushY(chart.ben.yaos.filter(function (x) { return x.isShi; })[0]);
  if (cmp.shiYingKongPo) { /* noop */ }
  return tags.join('/');
}

let pass = 0, fail = 0;
const bad = [];
console.log('==== 卦例评测基准（' + BENCH.length + ' 例）====');
console.log('模块'.padEnd(9) + '问句'.padEnd(22) + '用神'.padEnd(8) + '吉凶'.padEnd(6) + '应期');
BENCH.forEach(function (c) {
  const mod = CFG.MODULES[c.mod];
  const chart = LY.arrange(CHARTS[c.chart]);
  const t = CFG.chartText(chart, mod, c.q);
  const m = t.match(/(兄弟|子孙|妻财|父母|官鬼|世爻|应爻)为用神/);
  const use = m ? m[1] : '?';
  const vm = t.match(/比较结论：([^\n]*)/);
  const vdir = vm ? verdictDir(vm[1]) : '?';
  const yt = yingTags(chart, use);
  const okUse = use === c.useGod;
  const okVer = vdir === c.verdict;
  const okYing = yt.length > 0;
  const line = c.mod.padEnd(9) + c.q.padEnd(22) + (use + (okUse ? '✓' : '✗')).padEnd(8) + (vdir + (okVer ? '✓' : '✗')).padEnd(6) + yt;
  console.log(line);
  if (okUse && okVer && okYing) pass++;
  else { fail++; bad.push(c.mod + '|' + c.q + ' | 期望用=' + c.useGod + '/实=' + use + ' 期望凶=' + c.verdict + '/实=' + vdir); }
});

console.log('\n==== 标准答案要点（供 AI 总断评测对齐）====');
BENCH.forEach(function (c) { console.log('· [' + c.mod + '] ' + c.q + ' → 用神=' + c.useGod + '(' + c.source + ')　吉凶=' + c.verdict + '　' + c.note); });

console.log('\n==== 准度汇总 ====');
console.log('通过：' + pass + '/' + BENCH.length + '　未通过：' + fail);
if (fail) { console.log('未通过明细：'); bad.forEach(function (b) { console.log('  ✗ ' + b); }); }
else console.log('全绿：用神解析/吉凶方向/应期方向均与冻结标准答案一致。');
