// 验证动爻化出之变爻：化进 / 化退 / 化回头生克 / 化墓 / 化绝 / 化空 / 化破
var path = require('path');
var CFG = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'config.js'));

var pass = 0, fail = 0;
function has(name, y, by, kw) {
  var tags = CFG.huaRelation(y, by).join('；');
  var okk = tags.indexOf(kw) >= 0;
  if (okk) { pass++; console.log('  ok  ' + name + ' → ' + kw); }
  else { fail++; console.log('  FAIL ' + name + ' 期望含「' + kw + '」实际→ ' + (tags || '（无）')); }
}
function mk(zhi, wx, extra) {
  var o = { zhi: zhi, wuxing: wx, ganzhi: '甲' + zhi, isKong: false, isYuePo: false, wang: { level: '相', marks: [] } };
  if (extra) for (var k in extra) o[k] = extra[k];
  return o;
}

// 化退神：子→亥、卯→寅、午→巳、酉→申、辰→丑、未→辰、戌→未、丑→戌
has('子化亥', mk('子', '水'), mk('亥', '水'), '化退神');
has('卯化寅', mk('卯', '木'), mk('寅', '木'), '化退神');
has('午化巳', mk('午', '火'), mk('巳', '火'), '化退神');
has('酉化申', mk('酉', '金'), mk('申', '金'), '化退神');
has('辰化丑', mk('辰', '土'), mk('丑', '土'), '化退神');

// 化进神：亥→子、寅→卯、巳→午、申→酉、丑→辰、辰→未、未→戌、戌→丑
has('亥化子', mk('亥', '水'), mk('子', '水'), '化进神');
has('寅化卯', mk('寅', '木'), mk('卯', '木'), '化进神');
has('申化酉', mk('申', '金'), mk('酉', '金'), '化进神');
has('丑化辰', mk('丑', '土'), mk('辰', '土'), '化进神');

// 进退互斥：寅化子 既非进也非退
(function () {
  var t = CFG.huaRelation(mk('寅', '木'), mk('子', '水')).join('；');
  var okk = t.indexOf('化进神') < 0 && t.indexOf('化退神') < 0;
  if (okk) { pass++; console.log('  ok  寅化子 不判进退'); } else { fail++; console.log('  FAIL 寅化子 误判→ ' + t); }
})();

// 回头生克：本爻木，化出水（水生木）＝化回头生；化出金（金克木）＝化回头克
has('木化水', mk('寅', '木'), mk('子', '水'), '化回头生');
has('木化金', mk('寅', '木'), mk('申', '金'), '化回头克');

// 化墓/化绝（按本爻五行起长生十二宫）
has('寅木化未', mk('寅', '木'), mk('未', '土'), '化墓');
has('寅木化申', mk('寅', '木'), mk('申', '金'), '化绝');

// 化空 / 化破
has('化空', mk('寅', '木'), mk('卯', '木', { isKong: true }), '化空');
has('化破', mk('寅', '木'), mk('卯', '木', { isYuePo: true }), '化破');

console.log('\n变爻化出关系校验: 通过 ' + pass + ' 项, 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
