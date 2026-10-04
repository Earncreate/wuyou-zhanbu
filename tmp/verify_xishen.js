/* 喜神（子孙）恒真关系验证 —— 不依赖主观判断，纯五行机械核对
 *
 * 背景：本项目六亲五行随卦宫推导（父母=生我者、兄弟=同我者、子孙=我生者、
 *       妻财=我克者、官鬼=克我者），五行生克表是死的。凡是想在文案里硬写的
 *       "X 生/克 Y" 六亲断言，必须先在**全部五宫**都成立才允许写死，
 *       否则必须改成"以本卦卦宫五行实算为准"。
 *       此前 22 模块全量审计抓出 24 处写死生克错误，即因少了这一步。
 *
 * 本脚本同时作为回归：喜神文案若引入新的写死断言，须先在此登记并验过。
 */
const LY = require('../libs/liuyao.js');

// 五行相生/相克：固定不变，与卦宫无关
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE    = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

const ELEMENTS = ['金', '木', '水', '火', '土'];
const LIUQIN   = ['兄弟', '子孙', '妻财', '父母', '官鬼'];

// 候选"恒真"断言：只有五宫全部通过，才允许在文案里写死
const CANDIDATES = [
  { a: '子孙', op: '克', b: '官鬼', why: '喜神之据：子孙为发泄舒畅之神，能解官鬼之忧患' },
  { a: '兄弟', op: '生', b: '子孙', why: '—' },
  { a: '子孙', op: '生', b: '妻财', why: '子孙为财源' },
  { a: '父母', op: '生', b: '兄弟', why: '—' },
  { a: '妻财', op: '生', b: '官鬼', why: '—' },
  { a: '父母', op: '克', b: '子孙', why: '印克食伤直觉，疑在本项目约定下不成立' },
  { a: '官鬼', op: '克', b: '兄弟', why: '—' }
];

function check(c) {
  const res = ELEMENTS.map(function (el) {
    const m = LY.lqWuxing(el);
    const va = m[c.a], vb = m[c.b];
    const ok = c.op === '克' ? KE[va] === vb : SHENG[va] === vb;
    return { el: el, a: c.a + '(' + va + ')', b: c.b + '(' + vb + ')', ok: ok };
  });
  const all = res.every(function (r) { return r.ok; });
  return { all: all, res: res, c: c };
}

console.log('============ 六亲五行随卦宫推导结果 ============');
ELEMENTS.forEach(function (el) {
  const m = LY.lqWuxing(el);
  console.log('  ' + el + '宫：' + LIUQIN.map(function (l) { return l + '=' + m[l]; }).join('  '));
});

console.log('\n============ 恒真断言候选（须五宫全通过）============');
let trueN = 0, falseN = 0;
CANDIDATES.forEach(function (c) {
  const r = check(c);
  const tag = r.all ? '✓ 恒真（可写死）' : '✗ 非常真（须改用"以卦宫实算"措辞）';
  console.log('  ' + tag + '　' + c.a + c.op + c.b + '　' + (r.res.every(function (x) { return x.ok; }) ? '' : '失败宫：' + r.res.filter(function (x) { return !x.ok; }).map(function (x) { return x.el; }).join('/')));
  if (!r.all) {
    r.res.filter(function (x) { return !x.ok; }).forEach(function (x) {
      console.log('       ' + x.el + '宫：' + x.a + ' ' + c.op + ' ' + x.b + ' 不成立');
    });
  }
  r.all ? trueN++ : falseN++;
});

console.log('\n============ 汇总 ============');
console.log('恒真 ' + trueN + ' 条 / 非常真 ' + falseN + ' 条');

// 喜神硬门槛：子孙克官鬼必须恒真，否则喜神文案不得写死该关系
const xs = check(CANDIDATES[0]);
if (!xs.all) {
  console.error('\n[HARD FAIL] 子孙克官鬼并非恒真 → 喜神文案不得写死该方向，须改为引擎实算。');
  process.exit(1);
}
console.log('喜神硬门槛通过：子孙克官鬼于五宫皆成立，可写死"子孙能克制官鬼"这一层功能描述。');
console.log('\n注意（防 illness 反置）：喜神名号只描述"子孙对官鬼的固有解救功能"，');
console.log('并非说子孙在任何占里都是吉神。以用神为太极点时子孙仍可能是忌神/仇神，');
console.log('吉凶一律回到用神旺衰实算——此作用域限定须随喜神文案一同注入。');
