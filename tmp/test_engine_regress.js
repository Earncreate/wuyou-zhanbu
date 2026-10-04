/* 全 64 卦引擎回归：验证查表改动后 arrange 对任意卦/日月不崩、旬空合法、用神生克图可取 */
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');

// 覆盖六旬首（甲子/甲戌/甲申/甲午/甲辰/甲寅）及其相邻日，确保 6 种旬空都触发
const DAYS = ['甲子','乙丑','戊辰','甲戌','丙子','甲申','庚辰','甲午','丁酉','甲辰','壬子','甲寅','己巳','癸酉'];
const MONTHS = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
let total = 0, errs = 0, badKong = 0, badRole = 0;
const MODS = ['loveM','loveF','wealth','career','illness','child','study','job','lost','fun'];

for (let id = 0; id < 64; id++) {
  // 由 0..63 反推 sixYang（上卦 idx*8 + 下卦 idx）
  const upperIdx = Math.floor(id / 8), lowerIdx = id % 8;
  const sixYang = [
    lowerIdx & 1, (lowerIdx >> 1) & 1, (lowerIdx >> 2) & 1,
    upperIdx & 1, (upperIdx >> 1) & 1, (upperIdx >> 2) & 1
  ];
  // 让一个爻变（老阳/老阴）以触发变卦路径
  const six = sixYang.map((v, i) => ({ sum: i === 2 ? 9 : (v ? 7 : 8) }));
  for (const mg of MONTHS) for (const dg of DAYS) {
    let chart;
    try {
      chart = LY.arrange({ six, monthGanZhi: '丙' + mg, dayGanZhi: dg });
    } catch (e) { errs++; if (errs <= 3) console.error('CRASH id=' + id + ' ' + dg + ': ' + e.message); continue; }
    total++;
    const kong = chart.xunkong;
    if (!Array.isArray(kong) || kong.length !== 2 || !kong[0] || !kong[1]) badKong++;
    // 用神生克图（随机抽一个模块）
    const m = MODS[id % MODS.length];
    try {
      const r = LY.getUseGodRelation(chart, SYM.MOD_USE ? SYM.MOD_USE[m] : null);
      if (SYM.MOD_USE && SYM.MOD_USE[m] && !r) badRole++;
    } catch (e) { badRole++; if (badRole <= 3) console.error('ROLE ERR id=' + id + ' ' + m + ': ' + e.message); }
  }
}
console.log('回归样本数=' + total + '  崩溃=' + errs + '  旬空异常=' + badKong + '  用神图异常=' + badRole);
console.log(errs === 0 && badKong === 0 && badRole === 0 ? '✅ 全 64 卦引擎回归通过' : '❌ 存在异常，需排查');
