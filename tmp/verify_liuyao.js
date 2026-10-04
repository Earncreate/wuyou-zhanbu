/**
 * 排盘正确性核对脚本
 * 依据《卜筮正宗》《增删卜易》的京房纳甲体系，对 liuyao.js 做断言校验。
 *   用法: node tmp/verify_liuyao.js
 * 六爻底层阴阳（自下而上）按真实卦画编码：
 *   乾111 兑110 离101 震100 巽011 坎010 艮001 坤000
 */
var path = require('path');
var LY = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'liuyao.js'));

var BITS = {
  qian: [1, 1, 1], dui: [1, 1, 0], li: [1, 0, 1], zhen: [1, 0, 0],
  xun: [0, 1, 1], kan: [0, 1, 0], gen: [0, 0, 1], kun: [0, 0, 0]
};

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('  ✗ FAIL: ' + name + (extra ? '  → ' + JSON.stringify(extra) : '')); }
}

// 由上下卦 key 构造排盘
function chart(lowerKey, upperKey, dayGZ, monthGZ) {
  var six = BITS[lowerKey].concat(BITS[upperKey]);
  var raw = six.map(function (b) { return { sum: b ? 7 : 8 }; });
  return LY.arrange({ monthGanZhi: monthGZ || '丙寅', dayGanZhi: dayGZ || '甲子', six: raw });
}

// ---------- 1. 八宫世应 ----------
var qianGong = [
  ['乾为天', 'qian', 'qian', 6],
  ['天风姤', 'xun', 'qian', 1],
  ['天山遯', 'gen', 'qian', 2],
  ['天地否', 'kun', 'qian', 3],
  ['风地观', 'kun', 'xun', 4],
  ['山地剥', 'kun', 'gen', 5],
  ['火地晋', 'kun', 'li', 4],   // 游魂
  ['火天大有', 'qian', 'li', 3] // 归魂
];
qianGong.forEach(function (row) {
  var c = chart(row[1], row[2], '甲子', '丙寅');
  ok(row[0] + ' 世爻位置', c.ben.info.shi === row[3], { got: c.ben.info.shi, want: row[3] });
  var yingWant = ((row[3] + 2) % 6) + 1;
  ok(row[0] + ' 应爻位置(隔三爻)', c.ben.info.ying === yingWant, { got: c.ben.info.ying, want: yingWant });
});
// 本宫/游魂/归魂标签
ok('乾为天 本宫标签', chart('qian', 'qian').ben.info.tag === '本宫');
ok('火地晋 游魂标签', chart('kun', 'li').ben.info.tag === '游魂');
ok('火天大有 归魂标签', chart('qian', 'li').ben.info.tag === '归魂');

// ---------- 2. 乾为天 纳甲/六亲/六神/十二长生/旬空/月破 ----------
var qian = chart('qian', 'qian', '甲子', '丙寅');
var qg = [['甲子', '水', '子孙'], ['甲寅', '木', '妻财'], ['甲辰', '土', '父母'],
          ['壬午', '火', '官鬼'], ['壬申', '金', '兄弟'], ['壬戌', '土', '父母']];
qian.ben.yaos.forEach(function (y, i) {
  ok('乾为天 初..上 干支[' + i + ']', y.ganzhi === qg[i][0], { got: y.ganzhi, want: qg[i][0] });
  ok('乾为天 六亲[' + i + ']', y.liuqin === qg[i][2], { got: y.liuqin, want: qg[i][2] });
});
// 六神：甲/乙日起青龙（甲乙→0）
var shenWant = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];
qian.ben.yaos.forEach(function (y, i) {
  ok('乾为天 六神[' + i + ']', y.liushen === shenWant[i], { got: y.liushen, want: shenWant[i] });
});
// 十二长生：日干甲(木)长生在亥 → 子沐浴 寅临官 辰衰 午死 申绝 戌养
var csWant = ['沐浴', '临官', '衰', '死', '绝', '养'];
qian.ben.yaos.forEach(function (y, i) {
  ok('乾为天 十二长生[' + i + ']', y.changsheng === csWant[i], { got: y.changsheng, want: csWant[i] });
});
// 旬空：甲子旬空戌亥
ok('甲子日 旬空', qian.xunkong.join('、') === '戌、亥', { got: qian.xunkong });
// 月破：月建寅冲申
ok('月建寅 月破', qian.yuepo === '申', { got: qian.yuepo });
ok('五爻壬申 临月破', qian.ben.yaos[4].isYuePo === true);

// ---------- 3. 坤为地 纳甲/六亲 ----------
var kun = chart('kun', 'kun', '乙丑', '乙未');
var kg = [['乙未', '兄弟'], ['乙巳', '父母'], ['乙卯', '官鬼'], ['癸丑', '兄弟'], ['癸亥', '妻财'], ['癸酉', '子孙']];
kun.ben.yaos.forEach(function (y, i) {
  ok('坤为地 干支[' + i + ']', y.ganzhi === kg[i][0], { got: y.ganzhi, want: kg[i][0] });
  ok('坤为地 六亲[' + i + ']', y.liuqin === kg[i][1], { got: y.liuqin, want: kg[i][1] });
});

// ---------- 4. 十二长生 换日干(金) ----------
var qianJin = chart('qian', 'qian', '庚午', '丙寅'); // 庚辛金，长生在巳
ok('庚日 乾为天 初爻十二长生=死', qianJin.ben.yaos[0].changsheng === '死', { got: qianJin.ben.yaos[0].changsheng });

// ---------- 5. 伏神（本宫乾，天风姤） ----------
var gou = chart('xun', 'qian', '甲子', '丙寅'); // 天风姤，本宫乾
ok('天风姤 有伏神', gou.ben.fu && gou.ben.fu.length === 6);
ok('天风姤 伏神初爻=甲子子孙', gou.ben.fu[0].ganzhi === '甲子' && gou.ben.fu[0].liuqin === '子孙',
  gou.ben.fu[0] && { gz: gou.ben.fu[0].ganzhi, lq: gou.ben.fu[0].liuqin });

// ---------- 6. 动爻→变卦 ----------
var rawMove = [{ sum: 9 }, { sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }]; // 初爻老阳发动
var cm = LY.arrange({ monthGanZhi: '丙寅', dayGanZhi: '甲子', six: rawMove });
ok('老阳发动 有变卦', !!cm.bian);
ok('老阳发动 初爻变阴', cm.bian.six[0] === 0);
ok('变爻标注', cm.bian.yaos[0].isChanged === true);

console.log('\n排盘校验结果: 通过 ' + pass + ' 项, 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
