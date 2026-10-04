/* 逐模块用神对照《卜筮正宗·用神分类定例第一》《世应论用神第二》
 * —— 用户要求"最后到各个模块一一再次验证"。这里把每个模块的用神拿去对照原书归类，而非自证。
 *
 * 《卜筮正宗》卷三·用神分类定例第一（原文节录）：
 *   父母：祖父母、父母、師長、家主、伯叔姑姨…牆城宅舍、舟車、衣服雨具、求雨…章奏文章、館室
 *   官鬼：功名、官府、雷電、鬼神、丈夫、夫之兄弟同輩…亂臣盜賊、邪祟、憂疑、病症、尸首、逆風
 *   兄弟：兄弟姊妹、姊妹丈、妻之兄弟、結盟同寅、知交朋友
 *   妻財：嫂與弟婦、妻妾及友人之妻妾、婢僕、物價錢財珠寶金銀、倉庫錢糧、什物器皿、問天時晴明
 *   子孫：兒女孫姪、女壻門生、忠臣良將、藥材僧道、六畜禽鳥、順風、解憂避禍、問天時日月星斗
 * 《世應論用神第二》（原文节录）：
 *   凡占自己疾病、或問壽數、或問出行吉凶、諸凡損益自身者，以世爻為用；
 *   凡占無尊卑之稱呼、未曾深交之朋友、九流術士、優人、敵國，或指實某處地頭…俱以應爻為用神。
 */
const LY = require('../libs/liuyao.js');
const SYM = require('../libs/symbol_dict.js');

const chart = LY.arrange({
  six: [{ sum: 7 }, { sum: 8 }, { sum: 7 }, { sum: 8 }, { sum: 9 }, { sum: 8 }],
  monthGanZhi: '丙寅', dayGanZhi: '甲子'
});

const CASES = [
  { mod: 'loveM',   q: '我和她的感情能成吗',   expect: '妻财', src: '妻妾—>妻財' },
  { mod: 'loveF',   q: '他什么时候会出现',     expect: '官鬼', src: '丈夫—>官鬼' },
  { mod: 'wealth',  q: '这笔生意能赚钱吗',     expect: '妻财', src: '錢財—>妻財' },
  { mod: 'child',   q: '什么时候能怀上孩子',   expect: '子孙', src: '兒女—>子孫' },
  { mod: 'study',   q: '这次考试能过吗',       expect: '父母', src: '文章館室—>父母' },
  { mod: 'career',  q: '今年能升职吗',         expect: '官鬼', src: '功名官府—>官鬼' },
  { mod: 'job',     q: '这个offer能拿到吗',    expect: '官鬼', src: '功名官府—>官鬼' },
  { mod: 'news',    q: '那边的消息什么时候到', expect: '父母', src: '章奏文章—>父母' },
  { mod: 'home',    q: '这套房子能买吗',       expect: '父母', src: '牆城宅舍—>父母' },
  { mod: 'lawsuit', q: '这场官司能赢吗',       expect: '官鬼', src: '官府盜賊—>官鬼' },
  { mod: 'illness', q: '我这个病严重不严重',   expect: '官鬼', src: '病症憂疑—>官鬼' },
  { mod: 'lost',    q: '丢的东西能找回来吗',   expect: '妻财', src: '什物器皿錢財—>妻財' },
  { mod: 'diet',    q: '今天吃什么比较合适',   expect: '妻财', src: '倉庫錢糧—>妻財' },
  { mod: 'fun',     q: '去哪儿玩比较尽兴',     expect: '子孙', src: '解憂避禍—>子孫（喜神）' }
];

console.log('============ 一、14 固定用神模块 对照《用神分类定例第一》 ============');
let pass = 0, fail = 0;
for (const c of CASES) {
  const r = SYM.resolveUseGod(c.mod, c.q, chart);
  const got = r.useLq;
  const ok = got === c.expect;
  ok ? pass++ : fail++;
  console.log('  [' + (ok ? '✓' : '✗') + '] ' + c.mod + '：得「' + got + '」（source=' + r.source + '）'
    + '　应=「' + c.expect + '」　《正宗》：' + c.src);
}

console.log('\n============ 二、世爻为体的模块 对照《世应论用神第二》 ============');
// "問出行吉凶…諸凡損益自身者以世爻為用"
const SHI_CASES = [
  { mod: 'travel',  q: '我明天出门远行平安吗' },
  { mod: 'general', q: '问这事能不能成' },
  { mod: 'fweek',   q: '本周整体运势怎么样' },
  { mod: 'fyear',   q: '今年一整年顺不顺' },
  { mod: 'misc',    q: '这件事顺利吗' },
  { mod: 'num',     q: '选个吉利数字6' }
];
const shiLq = (function () {
  const y = chart.ben.yaos.filter((a) => a.shiTag === '世')[0];
  return y ? y.liuqin : null;
})();
console.log('  本卦世爻所临六亲＝' + shiLq + '（按《正宗》—>为上述诸占之用神）');
for (const c of SHI_CASES) {
  const r = SYM.resolveUseGod(c.mod, c.q, chart);
  const ok = r.source === '世爻' && r.useLq === shiLq;
  ok ? pass++ : fail++;
  console.log('  [' + (ok ? '✓' : '✗') + '] ' + c.mod + '：得「' + r.useLq + '」source=' + r.source
    + (ok ? '　—>与世爻为体相符' : '　—>未按世爻取体'));
}

console.log('\n============ 三、应爻为体的情形 对照《世应论用神第二》 ============');
// "無尊卑之稱呼、未曾深交之朋友…俱以應爻為用神"：显式称谓与泛指人称
const YING_CASES = [
  { mod: 'person', q: '对方靠谱吗' },
  { mod: 'person', q: '那个合作方是什么意思' },
  { mod: 'general', q: '他最近怎么样' },
  { mod: 'general', q: '她身体还好吗' },
  { mod: 'general', q: '这个人靠不靠谱' }
];
for (const c of YING_CASES) {
  const r = SYM.resolveUseGod(c.mod, c.q, chart);
  const ok = r.useLq === '应爻' && r.daiZhan === true;
  ok ? pass++ : fail++;
  console.log('  [' + (ok ? '✓' : '✗') + '] ' + c.mod + '「' + c.q + '」：得「' + r.useLq + '」daiZhan=' + !!r.daiZhan
    + (ok ? '　—>合"未深交者以應爻為用神"' : '　—>未切应爻'));
}

console.log('\n============ 四、显现代占不得被泛指人称抢先 ============');
const PRIO = [
  { q: '我妈身体怎么样', expect: '父母' },
  { q: '我领导最近怎么样', expect: '官鬼' },
  { q: '我儿子什么时候回来', expect: '子孙' },
  { q: '我老婆情绪不太对', expect: '妻财' }
];
for (const c of PRIO) {
  const r = SYM.resolveUseGod('general', c.q, chart);
  const ok = r.useLq === c.expect && r.source === '代占';
  ok ? pass++ : fail++;
  console.log('  [' + (ok ? '✓' : '✗') + '] 「' + c.q + '」：得「' + r.useLq + '」source=' + r.source
    + '　应=「' + c.expect + '」（显式称谓须优先于泛指人称）');
}

console.log('\n============ 五、泛指人称的保守闸门（宁漏勿错） ============');
const STOP = [
  { q: '其他方面还有要注意的吗' },
  { q: '他日再来占问' },
  { q: '他欠我的钱我能要回来吗' },
  { q: '这笔投资能回本吗' }
];
for (const c of STOP) {
  const r = SYM.resolveUseGod('general', c.q, chart);
  const ok = !(r.useLq === '应爻' && r.daiZhan === true);
  ok ? pass++ : fail++;
  console.log('  [' + (ok ? '✓' : '✗') + '] 「' + c.q + '」：得「' + r.useLq + '」source=' + r.source
    + (ok ? '　—>未误判为代占' : '　—>误触发泛指人称'));
}

console.log('\n============ 汇总 ============');
console.log('通过 ' + pass + ' 项，不符 ' + fail + ' 项');
process.exit(fail === 0 ? 0 : 1);
