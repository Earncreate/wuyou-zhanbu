#!/usr/bin/env node
/**
 * 取象三层数字索引专项测试（用户 2026-10-03 定范式）
 * 范式：模块中的事物＝第一特征，从第一特征划分的第二特征，从第二特征划分的第三特征（回归命理五行）；
 *      划分依据来自占卜典籍案例，同时保留现代人类对事物的拆解（材质/形态/状态/运动）；
 *      取象再绑定落爻（爻位 1~6 + 力量档数字 0~5）。
 * 锁死六件事：
 *   ① 用户基准例逐字对上：猪肉(3,2,4)、鸡肉(3,1,1)、有轨列车＝金属+长条+地面行驶
 *   ② 全 22 模块均有词表，三层编号全在字典内、无越界、均有 note
 *   ③ 现代拆解四维编号均在 MODERN 字典内
 *   ④ 落爻赋值与引擎 y.idx / y.wang 完全一致，全盘抽样无缺项
 *   ⑤ 模块隔离：专属表之间不串（career 不吃 diet 词）
 *   ⑥ 第三特征（方位序）与六亲五行（随卦宫）是两套号，引擎 liuqinYuanJi 未被污染
 */
const path = require('path');
const LY = require(path.join(__dirname, '..', 'libs', 'liuyao.js'));
const SYM = require(path.join(__dirname, '..', 'libs', 'symbol_dict.js'));

let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '　' + extra : '')); }
}
const c = LY.arrange({ six: [7, 8, 9, 8, 7, 7].map((s) => ({ sum: s })), monthGanZhi: '丙寅', dayGanZhi: '甲子' });
const y = SYM.pickXiangYao(c, 'diet');

console.log('【① 用户基准例逐字核对】');
[['猪肉', [3, 2, 4], '动物肉', '红肉'], ['鸡肉', [3, 1, 1], '动物肉', '白肉']].forEach(([w, exp, e1, e2]) => {
  const a = SYM.xiangAssign('diet', '今天吃' + w + '怎么样', y);
  const got = a ? [a.l1, a.l2, a.x] : null;
  ck(w + ' → (' + exp.join(',') + ')', got && got.join() === exp.join(), '实得 ' + JSON.stringify(got));
  ck(w + ' 层名 ' + e1 + '/' + e2, a && a.l1Name === e1 && a.l2Name === e2, a ? a.l1Name + '/' + a.l2Name : 'null');
});
// 有轨列车＝金属＋长条＋地面行驶（用户给的现代拆解例）
{
  const a = SYM.xiangAssign('travel', '坐有轨列车', SYM.pickXiangYao(c, 'travel'));
  ck('有轨列车＝金属＋长条形＋地面行驶', a && a.matName === '金属' && a.formName === '长条形' && a.motName === '地面行驶',
    a ? [a.matName, a.formName, a.motName].join('/') : 'null');
  ck('有轨列车第三特征属金（器械）', a && a.x === 3 && a.xName === '金', a ? a.x + '·' + a.xName : 'null');
}
{
  const a = SYM.xiangAssign('travel', '坐飞机', SYM.pickXiangYao(c, 'travel'));
  ck('飞机＝金属＋空中飞行', a && a.matName === '金属' && a.motName === '空中飞行', a ? [a.matName, a.motName].join('/') : 'null');
}

console.log('\n【② 全模块词表完整性与越界】');
const allMods = Object.keys(SYM.MOD_CLASS);
let noTbl = [], bad = [], n = 0;
allMods.forEach((m) => {
  const tb = SYM.modTable(m);
  if (!tb || !tb.terms || !tb.terms.length) { noTbl.push(m); return; }
  tb.terms.forEach((it) => {
    n++;
    if (!tb.L1[it.l1]) bad.push(m + '/' + it.w + ' L1=' + it.l1);
    if (!tb.L2[it.l2]) bad.push(m + '/' + it.w + ' L2=' + it.l2);
    if (!SYM.WUXING[it.x]) bad.push(m + '/' + it.w + ' 第三特征=' + it.x);
    if (!it.note) bad.push(m + '/' + it.w + ' 缺 note');
  });
});
ck('全 ' + allMods.length + ' 模块均有词表', noTbl.length === 0, noTbl.join(','));
ck('词条 ' + n + ' 条：三层编号均在字典内且均有 note', bad.length === 0, bad.slice(0, 5).join('；'));

console.log('\n【③ 现代拆解四维编号有效】');
let badM = [];
allMods.forEach((m) => {
  SYM.modTable(m).terms.forEach((it) => {
    if (!it.m) { badM.push(m + '/' + it.w + ' 缺 m'); return; }
    ['mat', 'form', 'state', 'mot'].forEach((k) => {
      const v = it.m[k];
      if (v !== null && !SYM.MODERN[k][v]) badM.push(m + '/' + it.w + ' ' + k + '=' + v);
    });
  });
});
ck('现代拆解四维（材质/形态/状态/运动）编号均有效', badM.length === 0, badM.slice(0, 5).join('；'));

console.log('\n【④ 落爻赋值（爻位 + 力量）与引擎一致】');
const a = SYM.xiangAssign('diet', '中午吃猪肉', y);
ck('落爻爻位 = 引擎 y.idx', a.pos === y.idx, a.pos + ' vs ' + y.idx);
ck('落爻六亲 = 引擎 y.liuqin', a.liuqin === y.liuqin, a.liuqin + ' vs ' + y.liuqin);
ck('力量分 = 引擎 y.wang.score', a.score === y.wang.score, a.score + ' vs ' + y.wang.score);
ck('力量档名 = 引擎 y.wang.level', a.level === y.wang.level, a.level + ' vs ' + y.wang.level);
ck('爻位落在 1~6', a.pos >= 1 && a.pos <= 6, String(a.pos));
ck('力量档数字落在 0~5', a.powerSlot != null && a.powerSlot >= 0 && a.powerSlot <= 5, String(a.powerSlot));
ck('引擎六档与 POWER_SLOT 一一对应', Object.keys(SYM.POWER_SLOT).length === 6);
let miss = 0, n2 = 0;
for (let id = 0; id < 64; id++) {
  const up = Math.floor(id / 8), lo = id % 8;
  const yin = [lo & 1, (lo >> 1) & 1, (lo >> 2) & 1, up & 1, (up >> 1) & 1, (up >> 2) & 1];
  for (const mg of ['寅', '午', '子']) {
    let cc; try { cc = LY.arrange({ six: yin.map((v, i) => (i === 2 ? (v ? 9 : 6) : (v ? 7 : 8))).map((s) => ({ sum: s })), monthGanZhi: '丙' + mg, dayGanZhi: '甲子' }); } catch (e) { continue; }
    const yy = SYM.pickXiangYao(cc, 'diet');
    const aa = SYM.xiangAssign('diet', '吃猪肉', yy);
    n2++;
    if (!aa || !aa.pos || aa.score == null || aa.powerSlot == null) miss++;
  }
}
ck('全 64 卦 × 3 月抽样 ' + n2 + ' 例：落爻与力量赋值无缺项', miss === 0, '缺项 ' + miss);

console.log('\n【⑤ 模块隔离与注入】');
ck('专属表之间不串（career 问吃猪肉不命中）', SYM.xiangAssign('career', '今天吃猪肉', y) === null);
ck('career 能命中自己表内词（升职）', !!SYM.xiangAssign('career', '能升职吗', SYM.pickXiangYao(c, 'career')));
ck('通用表命中（general：工作顺利）', !!SYM.xiangAssign('general', '今天工作顺利吗', y));
ck('别名模块 job 共用 career 表', SYM.modTable('job') === SYM.modTable('career'));
ck('别名模块 loveF 共用 loveM 表', SYM.modTable('loveF') === SYM.modTable('loveM'));
const txt = SYM.selectSymbols(c, 'diet', { userText: '今天中午吃猪肉' });
ck('selectSymbols 注入取象数字索引段', /【取象·三层数字索引/.test(txt));
ck('注入段含三层数字与落爻', /猪肉：\(3,2,4\)/.test(txt) && /落爻\d/.test(txt));
ck('注入段含现代拆解', /现代拆解/.test(txt));
ck('注入段声明第三特征是唯一生克依据', /唯一参与生克计算|唯一依据/.test(txt));
ck('未提食物时不注入该段', !/【取象·三层数字索引/.test(SYM.selectSymbols(c, 'diet', { userText: '今天财运如何' })));

console.log('\n【⑥ 两套五行编号不混用】');
ck('第三特征按方位编号 1..5', Object.keys(SYM.WUXING).sort().join(',') === '1,2,3,4,5');
ck('1=东方木、4=北方水（与用户基准例一致）',
  SYM.WUXING[1].w === '木' && SYM.WUXING[1].dir === '东方' && SYM.WUXING[4].w === '水' && SYM.WUXING[4].dir === '北方');
const yj = LY.liuqinYuanJi('金', '父母');
const WX = Object.assign({}, LY.lqWuxing('金'));   // 六亲五行随卦宫，须用引擎实算
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
function sheng(a, b) { return SHENG[WX[a]] === WX[b]; }
function ke(a, b) { return KE[WX[a]] === WX[b]; }
ck('六亲五行仍走引擎（未被取象表污染）', WX['父母'] === '土' && WX['妻财'] === '木', JSON.stringify(WX));
ck('引擎原忌仇推导自洽：原神生用神、忌神克用神、仇神生忌神',
  sheng(yj.yuan, '父母') && ke(yj.ji, '父母') && sheng(yj.chou, yj.ji), JSON.stringify(yj));


console.log('\n【⑦ 要素层（每个事物 ≥3 个，按典籍次序）】');
const ORDER = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10'];
const diet = SYM.MOD_XIANG.diet;
ck('饮食模块事物数 ≥ 64（用户要求）', diet.terms.length >= 64, '实际 ' + diet.terms.length);
ck('全局要素库已导出（10 组）', !!SYM.ELEMENT && Object.keys(SYM.ELEMENT).length === 10 && SYM.EL_GROUP.length === 10);
let elBad = [], elOrd = [], elDup = [], elShort = [], elOver = [];
diet.terms.forEach((it) => {
  const el = it.el || [];
  if (el.length < 3) elShort.push(it.w + ':' + el.length);
  if (el.length > 9) elOver.push(it.w + ':' + el.length);
  if (new Set(el).size !== el.length) elDup.push(it.w);
  const gs = el.map((e) => e.split(':')[0]);
  for (let i = 1; i < gs.length; i++) if (ORDER.indexOf(gs[i]) < ORDER.indexOf(gs[i - 1])) { elOrd.push(it.w); break; }
  el.forEach((e) => { const p = e.split(':'); if (!SYM.ELEMENT[p[0]] || !SYM.ELEMENT[p[0]][p[1]]) elBad.push(it.w + ' ' + e); });
});
ck('每条要素数在 3~9 之间', elShort.length === 0 && elOver.length === 0, ('不足:' + elShort.join(',') + ' 超出:' + elOver.join(',')));
ck('要素编号全部在 ELEMENT 字典内', elBad.length === 0, elBad.slice(0, 4).join('；'));
ck('要素严格按典籍次序排列（组号非递减）', elOrd.length === 0, elOrd.slice(0, 4).join(','));
ck('同条内无重复要素', elDup.length === 0, elDup.slice(0, 4).join(','));
const elTotal = diet.terms.reduce((n, t) => n + t.el.length, 0);
ck('要素总数 ' + elTotal + ' 条，平均 ' + (elTotal / diet.terms.length).toFixed(2), elTotal >= 64 * 3);
ck('三层不重名（第一特征≠第二特征）', diet.terms.filter((t) => diet.L1[t.l1] === diet.L2[t.l2]).length === 0);
// 要素进入提示词
const elTxt = SYM.selectSymbols(c, 'diet', { userText: '今天中午吃猪肉' });
ck('注入段含类象要素', /类象要素（依典籍次序/.test(elTxt));
ck('注入段声明要素不参与生克', /要素只作取象类比，不参与生克/.test(elTxt));
const aEl = SYM.xiangAssign('diet', '今天吃猪肉', y);
ck('xiangAssign 透出 el 字段', Array.isArray(aEl.el) && aEl.el.length >= 3, String((aEl.el || []).length));


// ⑧ 类别候选层：问「吃什么肉」这类类别问句也须下沉为数字（此前整词匹配全不命中，模型自行判定宜忌）
ck('CATEGORY 表已定义 diet 类别', !!SYM.CATEGORY && SYM.CATEGORY.diet && SYM.CATEGORY.diet.length >= 10, String((SYM.CATEGORY.diet || []).length));
const ccat = SYM.xiangCategory('diet', '我适合吃什么肉');
ck('类别问句命中「肉食」', ccat && ccat.name === '肉食', ccat ? ccat.name : 'null');
ck('类别候选含全部肉食事物（≥20）', ccat && ccat.terms.length >= 20, ccat ? String(ccat.terms.length) : '0');
const ysY = SYM.pickRoleYao(c, 'diet', 'yongshen');
const jsY = SYM.pickRoleYao(c, 'diet', 'jishen');
ck('pickRoleYao 取到用神爻与忌神爻', !!ysY && !!jsY && !!ysY.wuxing && !!jsY.wuxing, (ysY && ysY.wuxing) + '/' + (jsY && jsY.wuxing));
ck('忌神六亲由引擎实算（与用神不同）', jsY && ysY && jsY.liuqin !== ysY.liuqin, (ysY && ysY.liuqin) + ' vs ' + (jsY && jsY.liuqin));
const cat = SYM.categoryAssess('diet', '我适合吃什么肉', ysY, jsY);
ck('categoryAssess 给出候选行', cat && cat.rows.length >= 3, cat ? String(cat.rows.length) : 'null');
ck('候选行含宜忌分且按分降序', cat && cat.rows.every((r) => typeof r.score === 'number')
  && cat.rows.every((r, i, a2) => i === 0 || a2[i - 1].score >= r.score));
ck('宜忌分区分度 ≥3（加权后非同分）', cat && new Set(cat.rows.map((r) => r.score)).size >= 3,
  cat ? Array.from(new Set(cat.rows.map((r) => r.score))).join(',') : '');
// 不同卦同一问句宜忌须不同（权重随旺衰变）
const c2 = LY.arrange({ six: [7, 8, 9, 8, 7, 7].map((x) => ({ sum: x })), monthGanZhi: '丙寅', dayGanZhi: '戊戌' });
const ys2 = SYM.pickRoleYao(c2, 'diet', 'yongshen'), js2 = SYM.pickRoleYao(c2, 'diet', 'jishen');
const cat2 = SYM.categoryAssess('diet', '我适合吃什么肉', ys2, js2);
ck('同问句不同卦：宜忌分随旺衰而变', cat && cat2 && cat.rows[0].score !== cat2.rows[0].score,
  (cat && cat.rows[0].score) + ' vs ' + (cat2 && cat2.rows[0].score));
// 注入
const catTxt = SYM.selectSymbols(c, 'diet', { userText: '我适合吃什么肉' });
ck('类别问句注入类别候选数字段', /【取象·类别候选数字/.test(catTxt));
ck('注入段声明模型不得自行判定宜忌', /不得自行判定宜忌/.test(catTxt));
ck('具体食物问句仍走单条三层（不重复注入类别层）',
  !/【取象·类别候选数字/.test(SYM.selectSymbols(c, 'diet', { userText: '今天吃猪肉' }))
  && /【取象·三层数字索引/.test(SYM.selectSymbols(c, 'diet', { userText: '今天吃猪肉' })));


// ⑨ 第二批模块（illness 78 / career 80）铺至 64 类以上且要素合规
['illness', 'career'].forEach((m) => {
  const t = SYM.MOD_XIANG[m];
  ck('【' + m + '】事物数 ≥ 64', t.terms.length >= 64, String(t.terms.length));
  ck('【' + m + '】全部带要素', t.terms.every((x) => x.el && x.el.length >= 3 && x.el.length <= 9));
  ck('【' + m + '】要素编号全在字典内', t.terms.every((x) => x.el.every((e) => {
    const q = e.split(':'); return SYM.ELEMENT[q[0]] && SYM.ELEMENT[q[0]][q[1]];
  })));
  ck('【' + m + '】要素按典籍次序', t.terms.every((x) => {
    const gs = x.el.map((e) => e.split(':')[0]);
    for (let i = 1; i < gs.length; i++) if (ORDER.indexOf(gs[i]) < ORDER.indexOf(gs[i - 1])) return false;
    return true;
  }));
  ck('【' + m + '】L1≠L2（三层不重名）', t.terms.every((x) => t.L1[x.l1] !== t.L2[x.l2]));
  ck('【' + m + '】第三特征有效', t.terms.every((x) => SYM.WUXING[x.x]));
  ck('【' + m + '】现代四维有效', t.terms.every((x) => x.m && ['mat', 'form', 'state', 'mot']
    .every((k) => x.m[k] === null || SYM.MODERN[k][x.m[k]])));
});
ck('illness 类别层已定义', !!(SYM.CATEGORY.illness && SYM.CATEGORY.illness.length >= 6), String((SYM.CATEGORY.illness || []).length));
ck('career 类别层已定义', !!(SYM.CATEGORY.career && SYM.CATEGORY.career.length >= 6), String((SYM.CATEGORY.career || []).length));
const cIll = SYM.categoryAssess('illness', '我得的是什么病', SYM.pickRoleYao(c, 'illness', 'yongshen'), SYM.pickRoleYao(c, 'illness', 'jishen'));
ck('illness 泛问命中「全部病类」并给出 5 行候选', cIll && cIll.cat === '全部病类' && cIll.rows.length === 5,
  cIll ? cIll.cat + '/' + cIll.rows.length : 'null');
ck('illness 候选按宜忌分降序', cIll && cIll.rows.every((r, i, a2) => i === 0 || a2[i - 1].score >= r.score));
ck('career 单条命中（升职）', (SYM.xiangAssign('career', '能升职吗', SYM.pickXiangYao(c, 'career')) || {}).l2 === 1);
ck('career 行业命中（金融）', (SYM.xiangAssign('career', '在金融行业干', SYM.pickXiangYao(c, 'career')) || {}).x === 3);
const illnessTxt = SYM.selectSymbols(c, 'illness', { userText: '我得的是什么病' });
ck('illness 泛问注入类别候选数字', /【取象·类别候选数字/.test(illnessTxt));
const careerTxt = SYM.selectSymbols(c, 'career', { userText: '能升职吗' });
ck('career 具体问句注入单条三层', /【取象·三层数字索引/.test(careerTxt) && /类象要素/.test(careerTxt));

// ⑩ 全 14 个专属模块铺至 64 类以上且要素合规（含本批新增 child/home/lawsuit/lost/news/travel/sport/fun）
['diet', 'illness', 'career', 'wealth', 'loveM', 'study', 'child', 'home', 'lawsuit', 'lost', 'news', 'travel', 'sport', 'fun'].forEach((m) => {
  const t = SYM.MOD_XIANG[m];
  ck('【' + m + '】事物数 ≥ 64', t.terms.length >= 64, String(t.terms.length));
  ck('【' + m + '】全部带要素', t.terms.every((x) => x.el && x.el.length >= 3 && x.el.length <= 9));
  ck('【' + m + '】要素编号全在字典内', t.terms.every((x) => x.el.every((e) => {
    const q = e.split(':'); return SYM.ELEMENT[q[0]] && SYM.ELEMENT[q[0]][q[1]];
  })));
  ck('【' + m + '】要素按典籍次序', t.terms.every((x) => {
    const gs = x.el.map((e) => e.split(':')[0]);
    for (let i = 1; i < gs.length; i++) if (ORDER.indexOf(gs[i]) < ORDER.indexOf(gs[i - 1])) return false;
    return true;
  }));
  ck('【' + m + '】L1≠L2（三层不重名）', t.terms.every((x) => t.L1[x.l1] !== t.L2[x.l2]));
  ck('【' + m + '】第三特征有效', t.terms.every((x) => SYM.WUXING[x.x]));
  ck('【' + m + '】现代四维有效', t.terms.every((x) => x.m && ['mat', 'form', 'state', 'mot']
    .every((k) => x.m[k] === null || SYM.MODERN[k][x.m[k]])));
  ck('【' + m + '】类别层已定义', !!(SYM.CATEGORY[m] && SYM.CATEGORY[m].length >= 6), String((SYM.CATEGORY[m] || []).length));
});
ck('wealth 单条命中（股票 l1=3）', (SYM.xiangAssign('wealth', '我想炒股票', SYM.pickXiangYao(c, 'wealth')) || {}).l1 === 3,
  JSON.stringify(SYM.xiangAssign('wealth', '我想炒股票', SYM.pickXiangYao(c, 'wealth'))));
ck('wealth 类别命中（生意行业）', (SYM.xiangCategory('wealth', '求财做什么生意') || {}).name === '生意行业',
  (SYM.xiangCategory('wealth', '求财做什么生意') || {}).name);
ck('study 单条命中（考试 x=2）', (SYM.xiangAssign('study', '我要考试', SYM.pickXiangYao(c, 'study')) || {}).x === 2,
  JSON.stringify(SYM.xiangAssign('study', '我要考试', SYM.pickXiangYao(c, 'study'))));
ck('study 类别命中（考试考核）', (SYM.xiangCategory('study', '考试考得怎样') || {}).name === '考试考核',
  (SYM.xiangCategory('study', '考试考得怎样') || {}).name);
ck('loveM 单条命中（对方身份 l1=1）', (SYM.xiangAssign('loveM', '我男朋友怎么样', SYM.pickXiangYao(c, 'loveM')) || {}).l1 === 1,
  JSON.stringify(SYM.xiangAssign('loveM', '我男朋友怎么样', SYM.pickXiangYao(c, 'loveM'))));
ck('loveM 类别命中（对方身份）', (SYM.xiangCategory('loveM', '我适合找什么样的人') || {}).name === '对方身份',
  (SYM.xiangCategory('loveM', '我适合找什么样的人') || {}).name);
const wCat = SYM.categoryAssess('wealth', '求财做什么生意', SYM.pickRoleYao(c, 'wealth', 'yongshen'), SYM.pickRoleYao(c, 'wealth', 'jishen'));
ck('wealth 类别候选按宜忌分降序', wCat && wCat.rows.every((r, i, a2) => i === 0 || a2[i - 1].score >= r.score), wCat ? String(wCat.rows.length) : 'null');
const sCat = SYM.categoryAssess('study', '全部学业', SYM.pickRoleYao(c, 'study', 'yongshen'), SYM.pickRoleYao(c, 'study', 'jishen'));
ck('study 类别候选 ≥ 3 行', sCat && sCat.rows.length >= 3, sCat ? String(sCat.rows.length) : 'null');
const lCat = SYM.categoryAssess('loveM', '我适合找什么样的人', SYM.pickRoleYao(c, 'loveM', 'yongshen'), SYM.pickRoleYao(c, 'loveM', 'jishen'));
ck('loveM 类别候选 ≥ 3 行', lCat && lCat.rows.length >= 3, lCat ? String(lCat.rows.length) : 'null');
// 新增 8 模块的功能接线（单条命中 + 类别命中）
ck('child 单条命中（非空）', !!(SYM.xiangAssign('child', '我男孩健康吗', SYM.pickXiangYao(c, 'child'))));
ck('child 类别命中（胎儿安危）', (SYM.xiangCategory('child', '怀孕要注意什么') || {}).name === '胎儿安危', (SYM.xiangCategory('child', '怀孕要注意什么') || {}).name);
ck('home 单条命中（非空）', !!(SYM.xiangAssign('home', '我要装修新房', SYM.pickXiangYao(c, 'home'))));
ck('home 类别命中（安宁之气）', (SYM.xiangCategory('home', '家里安宁吗') || {}).name === '安宁之气', (SYM.xiangCategory('home', '家里安宁吗') || {}).name);
ck('lawsuit 单条命中（非空）', !!(SYM.xiangAssign('lawsuit', '我要请律师', SYM.pickXiangYao(c, 'lawsuit'))));
ck('lawsuit 类别命中（证据文书）', (SYM.xiangCategory('lawsuit', '证据充分吗') || {}).name === '证据文书', (SYM.xiangCategory('lawsuit', '证据充分吗') || {}).name);
ck('lost 单条命中（手机 l1=1）', (SYM.xiangAssign('lost', '我手机丢了', SYM.pickXiangYao(c, 'lost')) || {}).l1 === 1, JSON.stringify(SYM.xiangAssign('lost', '我手机丢了', SYM.pickXiangYao(c, 'lost'))));
ck('lost 类别命中（能否寻回）', (SYM.xiangCategory('lost', '能找到吗') || {}).name === '能否寻回', (SYM.xiangCategory('lost', '能找到吗') || {}).name);
ck('news 单条命中（非空）', !!(SYM.xiangAssign('news', '有我的信吗', SYM.pickXiangYao(c, 'news'))));
ck('news 类别命中（消息）', (SYM.xiangCategory('news', '有什么新消息', SYM.pickXiangYao(c, 'news')) || {}).name === '消息', (SYM.xiangCategory('news', '有什么新消息') || {}).name);
ck('travel 单条命中（飞机 l1=2）', (SYM.xiangAssign('travel', '我想坐飞机', SYM.pickXiangYao(c, 'travel')) || {}).l1 === 2, JSON.stringify(SYM.xiangAssign('travel', '我想坐飞机', SYM.pickXiangYao(c, 'travel'))));
ck('travel 类别命中（行程）', (SYM.xiangCategory('travel', '出门顺利吗') || {}).name === '行程', (SYM.xiangCategory('travel', '出门顺利吗') || {}).name);
ck('sport 单条命中（非空）', !!(SYM.xiangAssign('sport', '我想去跑步', SYM.pickXiangYao(c, 'sport'))));
ck('sport 类别命中（胜负）', (SYM.xiangCategory('sport', '胜算如何') || {}).name === '胜负', (SYM.xiangCategory('sport', '胜算如何') || {}).name);
ck('fun 单条命中（非空）', !!(SYM.xiangAssign('fun', '我想看电影', SYM.pickXiangYao(c, 'fun'))));
ck('fun 类别命中（同伴）', (SYM.xiangCategory('fun', '朋友聚会') || {}).name === '同伴', (SYM.xiangCategory('fun', '朋友聚会') || {}).name);

console.log('\n  汇总：通过 ' + pass + '，失败 ' + fail);
process.exit(fail ? 1 : 0);
