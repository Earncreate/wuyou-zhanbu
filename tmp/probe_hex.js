// 从随机卦中挑出"用神持世或发动"的卦，保证模块对比测试里模块能真正区别于通用
const LY = require('../libs/liuyao.js');
const vals = [6, 7, 8, 9];
const TGT = { '父母': [], '官鬼': [], '妻财': [] };
function rnd() { return vals[Math.floor(Math.random() * 4)]; }
for (let n = 0; n < 12000; n++) {
  const six = []; for (let i = 0; i < 6; i++) six.push(rnd());
  const c = LY.arrange({ six: six.map(s => ({ sum: s })), monthGanZhi: '丙寅', dayGanZhi: '甲子' });
  const yaos = c.ben.yaos;
  ['父母', '官鬼', '妻财'].forEach(function (lq) {
    if (TGT[lq].length >= 5) return;
    const hit = yaos.filter(function (y) { return y.liuqin === lq; });
    if (hit.length) {
      const shi = hit.some(function (y) { return y.isShi; });
      const mv = hit.some(function (y) { return y.isMoving; });
      const kong = hit.some(function (y) { return y.isKong; });
      if (shi || mv) {
        TGT[lq].push({ six: six.join(','), name: c.ben.name, shi: shi, mv: mv, kong: kong, cnt: hit.length });
      }
    }
  });
}
Object.keys(TGT).forEach(function (k) {
  console.log('### 用神=' + k);
  TGT[k].forEach(function (r) { console.log(JSON.stringify(r)); });
});
