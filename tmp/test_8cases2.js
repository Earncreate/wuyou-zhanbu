/* 补充：导出每卦 世应 + 模块用神爻 的旺衰/空破/动变，供专家模拟产出结论 */
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');
const MONTH = '丙寅', DAY = '甲子';
const HEX = { H1: [9,8,7,6,7,8], H2: [6,7,8,9,7,8], H3: [8,9,7,6,8,7], H4: [9,6,8,7,9,6] };
const CASES = [
  { key:'H1', mod:'loveM',  q:'最近和对象总吵架，想问这段感情还能不能走下去' },
  { key:'H2', mod:'wealth', q:'想问最近这个小生意能不能赚到钱' },
  { key:'H3', mod:'career', q:'想知道今年我在单位能不能升职' },
  { key:'H4', mod:'illness',q:'最近老咳嗽睡不好，想问这病什么时候能好' }
];
function yd(y){ return `${y.posName}${y.zhi}/${y.liuqin}${y.isShi?'[世]':''}${y.isYing?'[应]':''}${y.isMoving?'动':''}${y.isKong?'空':''}${y.isYuePo?'破':''} 旺衰分=${y.wang?y.wang.score:'-'} marks=${(y.wang&&y.wang.marks||[]).join(',')} hua=${(y.hua&&y.hua.flags||[]).join(',')}`; }
for (const c of CASES) {
  const ch = LY.arrange({ six: HEX[c.key].map(s=>({sum:s})), monthGanZhi:MONTH, dayGanZhi:DAY });
  console.log('==== '+c.mod+' 卦='+ch.ben.name+' 动爻='+JSON.stringify(ch.moving.map(m=>m.pos)));
  ch.ben.yaos.forEach(y=> console.log('  '+yd(y)));
  const useLq = SYM.MOD_USE[c.mod];
  const useYs = ch.ben.yaos.filter(y=>y.liuqin===useLq);
  console.log('  模块用神('+useLq+')上卦='+(useYs.length? '是':'否(伏神取用)')+(useYs.length? '  '+useYs.map(yd).join(' | '):''));
}
