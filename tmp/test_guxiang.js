// 验证：模块 → 六神/六亲取象检索 + 状态 + 生克链 的拼接是否正确注入
var path = require('path');
var LY = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'liuyao.js'));
var CFG = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'config.js'));

// 造一卦：乾为天，初爻老阳发动（会变天风姤）
var six = [{ sum: 9 }, { sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }, { sum: 7 }];
var chart = LY.arrange({
  monthGanZhi: '丙寅', dayGanZhi: '甲子', jieqi: '立春',
  solarText: '公历 2026年2月4日', lunarText: '农历腊月十七', six: six
});

var pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

['diet', 'sport', 'fun'].forEach(function (id) {
  var mod = CFG.MODULES[id];
  var txt = CFG.chartText(chart, mod);
  ok(id + ' 含世应定位', txt.indexOf('世爻＝求测者本人') >= 0);
  ok(id + ' 含取象', txt.indexOf('取象：') >= 0);
  ok(id + ' 含状态', txt.indexOf('状态：') >= 0);
  ok(id + ' 含生克', txt.indexOf('生克：') >= 0);
  ok(id + ' 含伏神', txt.indexOf('【伏神】') >= 0);
  ok(id + ' 含内外卦象意(收口)', txt.indexOf('内外卦象意·收口补充') >= 0);
  ok(id + ' 象意不在开头', txt.indexOf('收口补充') > txt.indexOf('六爻明细'));
  ok(id + ' 含动爻变爻块', txt.indexOf('【动爻与变爻】') >= 0);
  ok(id + ' 含十二长生', txt.indexOf('十二长生') >= 0);
  ok(id + ' 含六亲传统类象', txt.indexOf('传统类象：') >= 0);
  ok(id + ' 无 undefined', txt.indexOf('undefined') < 0);
  if (id === 'diet') {
    // 饮食占：妻财应取象为食物
    ok('饮食 妻财取象=食物', txt.indexOf('妻财') >= 0 && txt.indexOf('食物、食材、餐食') >= 0);
    ok('饮食 应爻=吃喝的东西', txt.indexOf('应爻即吃喝的东西') >= 0);
    console.log('\n===== 饮食占注入样例（前 22 行）=====');
    console.log(txt.split('\n').slice(0, 22).join('\n'));
  }
  if (id === 'sport') {
    ok('运动 妻财取象=器材装备', txt.indexOf('健身器材、自行车') >= 0);
    ok('运动 应爻=运动的方式', txt.indexOf('应爻即运动的方式') >= 0);
  }
  if (id === 'fun') {
    ok('娱乐 妻财取象=花费门票', txt.indexOf('花费、门票') >= 0);
    ok('娱乐 应爻=娱乐的对象', txt.indexOf('应爻即娱乐的对象') >= 0);
  }
});

console.log('\n取象检索拼接校验: 通过 ' + pass + ' 项, 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
