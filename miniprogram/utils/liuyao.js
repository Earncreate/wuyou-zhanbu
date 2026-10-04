/**
 * 六爻排盘引擎 —— 京房纳甲体系
 * 可用于微信小程序(CommonJS) 与 H5(window.LiuYao)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.LiuYao = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  // ============ 基础常量 ============
  var TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // 六十甲子序号查表（0..59），供旬空/长生/干支索引 O(1) 查找（替代每行 O(60) 扫描）
  var GANZHI_INDEX = {};
  (function () {
    for (var i = 0; i < 60; i++) GANZHI_INDEX[TIANGAN[i % 10] + DIZHI[i % 12]] = i;
  })();
  function gzIndex2(gan, zhi) {
    var k = gan + zhi;
    return GANZHI_INDEX.hasOwnProperty(k) ? GANZHI_INDEX[k] : -1;
  }

  // 八卦阴阳（从下往上，1阳 0阴）
  var TRIGRAM = {
    qian: { name: '乾', symbol: '☰', bits: [1, 1, 1], idx: 7, nature: '天' },
    dui: { name: '兑', symbol: '☱', bits: [1, 1, 0], idx: 3, nature: '泽' },
    li: { name: '离', symbol: '☲', bits: [1, 0, 1], idx: 5, nature: '火' },
    zhen: { name: '震', symbol: '☳', bits: [1, 0, 0], idx: 1, nature: '雷' },
    xun: { name: '巽', symbol: '☴', bits: [0, 1, 1], idx: 6, nature: '风' },
    kan: { name: '坎', symbol: '☵', bits: [0, 1, 0], idx: 2, nature: '水' },
    gen: { name: '艮', symbol: '☶', bits: [0, 0, 1], idx: 4, nature: '山' },
    kun: { name: '坤', symbol: '☷', bits: [0, 0, 0], idx: 0, nature: '地' }
  };
  var IDX2TRI = {};
  for (var k in TRIGRAM) IDX2TRI[TRIGRAM[k].idx] = k;

  // 京房纳甲：内卦天干在前，外卦天干在后；纳支自初爻起
  var NAJIA = {
    qian: { ganIn: '甲', ganOut: '壬', zhi: ['子', '寅', '辰', '午', '申', '戌'], note: '乾纳甲壬' },
    kun: { ganIn: '乙', ganOut: '癸', zhi: ['未', '巳', '卯', '丑', '亥', '酉'], note: '坤纳乙癸' },
    zhen: { gan: '庚', zhi: ['子', '寅', '辰', '午', '申', '戌'], note: '震纳庚' },
    xun: { gan: '辛', zhi: ['丑', '亥', '酉', '未', '巳', '卯'], note: '巽纳辛' },
    kan: { gan: '戊', zhi: ['寅', '辰', '午', '申', '戌', '子'], note: '坎纳戊' },
    li: { gan: '己', zhi: ['卯', '丑', '亥', '酉', '未', '巳'], note: '离纳己' },
    gen: { gan: '丙', zhi: ['辰', '午', '申', '戌', '子', '寅'], note: '艮纳丙' },
    dui: { gan: '丁', zhi: ['巳', '卯', '丑', '亥', '酉', '未'], note: '兑纳丁' }
  };

  // 八宫卦序
  var PALACE_DEF = [
    { key: 'qian', element: '金', name: '乾宫', list: [['乾为天', 'qian', 'qian'], ['天风姤', 'qian', 'xun'], ['天山遯', 'qian', 'gen'], ['天地否', 'qian', 'kun'], ['风地观', 'xun', 'kun'], ['山地剥', 'gen', 'kun'], ['火地晋', 'li', 'kun'], ['火天大有', 'li', 'qian']] },
    { key: 'dui', element: '金', name: '兑宫', list: [['兑为泽', 'dui', 'dui'], ['泽水困', 'dui', 'kan'], ['泽地萃', 'dui', 'kun'], ['泽山咸', 'dui', 'gen'], ['水山蹇', 'kan', 'gen'], ['地山谦', 'kun', 'gen'], ['雷山小过', 'zhen', 'gen'], ['雷泽归妹', 'zhen', 'dui']] },
    { key: 'li', element: '火', name: '离宫', list: [['离为火', 'li', 'li'], ['火山旅', 'li', 'gen'], ['火风鼎', 'li', 'xun'], ['火水未济', 'li', 'kan'], ['山水蒙', 'gen', 'kan'], ['风水涣', 'xun', 'kan'], ['天水讼', 'qian', 'kan'], ['天火同人', 'qian', 'li']] },
    { key: 'zhen', element: '木', name: '震宫', list: [['震为雷', 'zhen', 'zhen'], ['雷地豫', 'zhen', 'kun'], ['雷水解', 'zhen', 'kan'], ['雷风恒', 'zhen', 'xun'], ['地风升', 'kun', 'xun'], ['水风井', 'kan', 'xun'], ['泽风大过', 'dui', 'xun'], ['泽雷随', 'dui', 'zhen']] },
    { key: 'xun', element: '木', name: '巽宫', list: [['巽为风', 'xun', 'xun'], ['风天小畜', 'xun', 'qian'], ['风火家人', 'xun', 'li'], ['风雷益', 'xun', 'zhen'], ['天雷无妄', 'qian', 'zhen'], ['火雷噬嗑', 'li', 'zhen'], ['山雷颐', 'gen', 'zhen'], ['山风蛊', 'gen', 'xun']] },
    { key: 'kan', element: '水', name: '坎宫', list: [['坎为水', 'kan', 'kan'], ['水泽节', 'kan', 'dui'], ['水雷屯', 'kan', 'zhen'], ['水火既济', 'kan', 'li'], ['泽火革', 'dui', 'li'], ['雷火丰', 'zhen', 'li'], ['地火明夷', 'kun', 'li'], ['地水师', 'kun', 'kan']] },
    { key: 'gen', element: '土', name: '艮宫', list: [['艮为山', 'gen', 'gen'], ['山火贲', 'gen', 'li'], ['山天大畜', 'gen', 'qian'], ['山泽损', 'gen', 'dui'], ['火泽睽', 'li', 'dui'], ['天泽履', 'qian', 'dui'], ['风泽中孚', 'xun', 'dui'], ['风山渐', 'xun', 'gen']] },
    { key: 'kun', element: '土', name: '坤宫', list: [['坤为地', 'kun', 'kun'], ['地雷复', 'kun', 'zhen'], ['地泽临', 'kun', 'dui'], ['地天泰', 'kun', 'qian'], ['雷天大壮', 'zhen', 'qian'], ['泽天夬', 'dui', 'qian'], ['水天需', 'kan', 'qian'], ['水地比', 'kan', 'kun']] }
  ];

  // 64卦索引表： upperIdx*8 + lowerIdx
  var GUA64 = {};
  PALACE_DEF.forEach(function (p) {
    p.list.forEach(function (row, i) {
      var upper = TRIGRAM[row[1]], lower = TRIGRAM[row[2]];
      var id = upper.idx * 8 + lower.idx;
      // 世爻：本宫卦世在六，一至五世依次在初至五，游魂在四，归魂在三
      var shi = (i === 0) ? 6 : (i <= 5 ? i : (i === 6 ? 4 : 3));
      var tag = i === 6 ? '游魂' : (i === 7 ? '归魂' : (i === 0 ? '本宫' : ''));
      GUA64[id] = {
        name: row[0], upper: row[1], lower: row[2],
        palace: p.key, palaceName: p.name, element: p.element,
        shi: shi, ying: ((shi + 2) % 6) + 1, order: i + 1, tag: tag
      };
    });
  });

  var ZHI_WX = { 子: '水', 亥: '水', 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 辰: '土', 戌: '土', 丑: '土', 未: '土' };
  var GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  var CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
  var SHENG_MAP = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  var KE_MAP = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

  var SHEN_ORDER = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];
  var SHEN_START = { 甲: 0, 乙: 0, 丙: 1, 丁: 1, 戊: 2, 己: 3, 庚: 4, 辛: 4, 壬: 5, 癸: 5 };

  // 纳音五行（六十甲子）→ 用于终身运"年命"之五行
  var NA_YIN = {
    '甲子': '金', '乙丑': '金', '丙寅': '火', '丁卯': '火', '戊辰': '木', '己巳': '木',
    '庚午': '土', '辛未': '土', '壬申': '金', '癸酉': '金', '甲戌': '火', '乙亥': '火',
    '丙子': '水', '丁丑': '水', '戊寅': '土', '己卯': '土', '庚辰': '金', '辛巳': '金',
    '壬午': '木', '癸未': '木', '甲申': '水', '乙酉': '水', '丙戌': '土', '丁亥': '土',
    '戊子': '火', '己丑': '火', '庚寅': '木', '辛卯': '木', '壬辰': '水', '癸巳': '水',
    '甲午': '金', '乙未': '金', '丙申': '火', '丁酉': '火', '戊戌': '木', '己亥': '木',
    '庚子': '土', '辛丑': '土', '壬寅': '金', '癸卯': '金', '甲辰': '火', '乙巳': '火',
    '丙午': '水', '丁未': '水', '戊申': '土', '己酉': '土', '庚戌': '金', '辛亥': '金',
    '壬子': '木', '癸丑': '木', '甲寅': '水', '乙卯': '水', '丙辰': '土', '丁巳': '土',
    '戊午': '火', '己未': '火', '庚申': '木', '辛酉': '木', '壬戌': '水', '癸亥': '水'
  };
  function nayinOf(gz) { return gz ? (NA_YIN[gz] || '') : ''; }
  // 五行之墓（水土同墓于辰）
  var MU = { 木: '未', 火: '戌', 金: '丑', 水: '辰', 土: '辰' };

  // 年命层：终身运以"生年支纳音五行"为命基，与世爻比生克墓空破
  function yearMingLayer(chart) {
    var gz = chart.birthYearGanZhi;
    if (!gz) return null;
    var ming = nayinOf(gz);
    if (!ming) return null;
    var shi = chart.ben.yaos.filter(function (y) { return y.isShi; })[0];
    if (!shi) return { ming: ming, shiZhi: '', rels: [] };
    var rels = [];
    var shiWx = shi.wuxing;
    if (SHENG_MAP[ming] === shiWx) rels.push('年命生世（命基助我，根基得力）');
    if (SHENG_MAP[shiWx] === ming) rels.push('世生年命（我泄于命，主付出多、得力少）');
    if (KE_MAP[ming] === shiWx) rels.push('年命克世（命基压身，根基受制）');
    if (KE_MAP[shiWx] === ming) rels.push('世克年命（我制命基，主自强）');
    var mu = MU[ming];
    if (mu && shi.zhi === mu) rels.push('世爻入年命之墓（根基被收，宜冲开方显）');
    if (shi.isKong) rels.push('世爻旬空（命基虚浮，宜填空实之）');
    if (shi.isYuePo) rels.push('世爻月破（命基动摇，宜出月逢合）');
    return { ming: ming, shiZhi: shi.zhi, rels: rels };
  }

  // 十二长生：以日干五行起长生十二宫（水土同宫，长生在申）
  var CHANGSHENG_ORDER = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
  var CHANGSHENG_START = { 木: '亥', 火: '寅', 金: '巳', 水: '申', 土: '申' };
  function changshengStage(zhi, dayGan) {
    var wxDay = GAN_WX[dayGan] || '土';
    var start = CHANGSHENG_START[wxDay];
    if (!start) return '长生';
    var idx = (DIZHI.indexOf(zhi) - DIZHI.indexOf(start) + 12) % 12;
    return CHANGSHENG_ORDER[idx];
  }

  // 伏神：取本宫首卦（八纯卦）同位爻的干支与六亲
  function getFuShen(info) {
    if (!info) return [];
    var pKey = info.palace;
    var pEl = info.element;
    var nj = NAJIA[pKey];
    if (!nj) return [];
    var fu = [];
    for (var i = 0; i < 6; i++) {
      var zhi = nj.zhi[i];
      var gan = nj.gan || (i < 3 ? nj.ganIn : nj.ganOut);
      var zhiWx = ZHI_WX[zhi];
      fu.push({
        pos: i + 1,
        gan: gan, zhi: zhi, ganzhi: gan + zhi,
        wuxing: zhiWx,
        liuqin: liuqinOf(pEl, zhiWx)
      });
    }
    return fu;
  }

  // ============ 工具 ============
  function gzIndex(gan, zhi) {
    var gi = TIANGAN.indexOf(gan), zi = DIZHI.indexOf(zhi);
    for (var i = 0; i < 60; i++) {
      if (i % 10 === gi && i % 12 === zi) return i;
    }
    return -1;
  }
  function liuqinOf(me, other) {
    if (other === me) return '兄弟';
    if (SHENG_MAP[other] === me) return '父母';
    if (SHENG_MAP[me] === other) return '子孙';
    if (KE_MAP[other] === me) return '官鬼';
    if (KE_MAP[me] === other) return '妻财';
    return '兄弟';
  }
  // ============ 六亲五行：随卦宫而定（非写死）============
  // 六亲是"我"（卦宫五行）的五行关系身份：生我者父母、同我者兄弟、我生者子孙、我克者妻财、克我者官鬼。
  // 故六亲→五行映射由卦宫五行推导，不可写死；五行生克（水生木…金克木）固定不变（"死的"）。
  var PRE_SHENG = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' }; // 生我者之五行（SHENG_MAP 之逆）
  var PRE_KE = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' };    // 克我者之五行（KE_MAP 之逆）
  // 给定卦宫五行 element（＝"我"），返回六亲→五行映射
  function lqWuxing(element) {
    return {
      '兄弟': element,            // 同我
      '父母': PRE_SHENG[element], // 生我
      '子孙': SHENG_MAP[element], // 我生
      '妻财': KE_MAP[element],    // 我克
      '官鬼': PRE_KE[element]     // 克我
    };
  }
  // 六亲五行口诀（随卦宫而定，按当前卦宫动态生成，供提示词与文档引用）
  function wuxingNote(element) {
    var m = lqWuxing(element);
    return '本卦卦宫属' + element + '（"我"），六亲五行随卦宫而定：兄弟＝' + m['兄弟'] +
      '、父母＝' + m['父母'] + '、子孙＝' + m['子孙'] + '、妻财＝' + m['妻财'] + '、官鬼＝' + m['官鬼'] +
      '。生克关系固定：水生木、木生火、火生土、土生金、金生水；木克土、土克水、水克火、火克金、金克木。';
  }
  var WUXING_NOTE = wuxingNote; // 保留旧引用名（symbol_dict 注入时按 chart 动态取，勿当字符串用）
  // 原神/忌神/仇神：以用神为太极点，按五行生克推导（生用神者＝原神、克用神者＝忌神、生忌神者＝仇神）
  // 六亲身份随卦宫而变，故必须传入卦宫五行 element，逐卦实算，不可写死。
  function liuqinYuanJi(element, useLq) {
    var map = lqWuxing(element);
    var wx = map[useLq];
    if (!wx) return null;
    var yuanWx = PRE_SHENG[wx]; // 生用神者之五行（原神）
    var jiWx = PRE_KE[wx];       // 克用神者之五行（忌神）
    var yuan = null, ji = null, chou = null;
    for (var k in map) { if (map[k] === yuanWx) yuan = k; if (map[k] === jiWx) ji = k; }
    if (ji) { var chouWx = PRE_SHENG[jiWx]; for (var k2 in map) { if (map[k2] === chouWx) chou = k2; } }
    return { yuan: yuan, ji: ji, chou: chou };
  }
  // 兼容旧 API：旧 deriveYuanJi(lq) 在写死五行下等价于金宫推导，现改为按传入卦宫实算
  function deriveYuanJi(element, lq) { return liuqinYuanJi(element, lq); }
  // 自校验：对全部 8 卦宫 × 5 用神，验证 原神生用神、忌神克用神、仇神生忌神（启动即跑，防改坏）
  function assertYuanJiAll() {
    var errs = [], els = ['金', '木', '水', '火', '土'];
    els.forEach(function (el) {
      var map = lqWuxing(el);
      ['兄弟', '子孙', '妻财', '父母', '官鬼'].forEach(function (lq) {
        var r = liuqinYuanJi(el, lq), wx = map[lq];
        if (!r || !r.yuan || PRE_SHENG[wx] !== map[r.yuan]) errs.push(el + '宫·' + lq + '.原神=' + (r && r.yuan) + ' 不生' + lq);
        if (!r || !r.ji || PRE_KE[wx] !== map[r.ji]) errs.push(el + '宫·' + lq + '.忌神=' + (r && r.ji) + ' 不克' + lq);
        if (r && r.yuan === r.ji) errs.push(el + '宫·' + lq + ' 原神忌神同为' + r.yuan);
        if (r && r.chou) {
          var jiWx = map[r.ji];
          if (PRE_SHENG[jiWx] !== map[r.chou]) errs.push(el + '宫·' + lq + '.仇神=' + r.chou + ' 不生忌神' + r.ji);
        }
      });
    });
    return errs;
  }
  var _YJ_ERRORS = assertYuanJiAll();
  function liuqinRelations(useLq) { return liuqinYuanJi('金', useLq); } // 兼容旧签名（默认金宫）
  // 五行在月日下的旺衰
  function wangShuai(wx, monthZhi, dayZhi) {
    var mwx = ZHI_WX[monthZhi], dwx = ZHI_WX[dayZhi];
    var score = 0, marks = [];
    if (mwx === wx) { score += 2; marks.push('月建同气'); }
    else if (SHENG_MAP[mwx] === wx) { score += 1; marks.push('月建生扶'); }
    else if (KE_MAP[mwx] === wx) { score -= 2; marks.push('月建克伐'); }
    if (dwx === wx) { score += 2; marks.push('日辰同气'); }
    else if (SHENG_MAP[dwx] === wx) { score += 1; marks.push('日辰生扶'); }
    else if (KE_MAP[dwx] === wx) { score -= 2; marks.push('日辰克伐'); }
    var level = score >= 3 ? '旺' : (score >= 1 ? '相' : (score <= -3 ? '衰极' : (score <= -1 ? '休囚' : '中性')));
    return { score: score, level: level, marks: marks };
  }

  // ==================== 力量引擎（条件判断 → 属性赋值 → 力量加减 → 比较） ====================
  // 架构：月建＝主（提纲，定旺相休囚死基线，一月恒定，不可动摇）
  //       日辰＝辅（执行，临生克冲合墓绝并救应月破填空，管始终，不可动摇）
  //       排盘六爻干支＝钩子（挂于架构上，只受架构作用、彼此可作用，绝不反作用于月日）
  var YUE_SCORE = { 旺: 3, 相: 2, 休: 0, 囚: -1, 死: -2 };
  var YUE_PO = -4;
  var RI_SCORE = { 日临: 4, 日生: 2, 日克: -2, 日合: 1, 暗动: 3, 日破: -3, 日墓: -2, 日长生: 2, 日帝旺: 2, 日绝: -4, 日害: -1 };
  var HUA_SCORE = { 化进: 2, 化退: -2, 回头生: 2, 回头克: -3, 化泄气: -1, 回头合: 1, 回头破: -4, 化墓: -2, 化绝: -4, 回头刑: -2, 化破: -1 };

  // 某五行之长生十二宫各位置的地支（0长生 4帝旺 9绝）
  function csZhiOf(wx, stageIdx) {
    var start = CHANGSHENG_START[wx];
    if (!start) return '';
    return DIZHI[(DIZHI.indexOf(start) + stageIdx) % 12];
  }
  function csStageOfZhi(zhi, wx) {
    var start = CHANGSHENG_START[wx];
    if (!start) return '';
    return CHANGSHENG_ORDER[(DIZHI.indexOf(zhi) - DIZHI.indexOf(start) + 12) % 12];
  }

  // A 月建层（主·提纲）：旺相休囚死 + 月破 / 月合。吉凶层不用十二长生。
  function monthLayer(zhi, monthZhi) {
    var wx = ZHI_WX[zhi], mwx = ZHI_WX[monthZhi];
    var state;
    if (wx === mwx) state = '旺';
    else if (SHENG_MAP[mwx] === wx) state = '相';
    else if (SHENG_MAP[wx] === mwx) state = '休';
    else if (KE_MAP[wx] === mwx) state = '囚';
    else state = '死';
    var flags = [];
    if (CHONG[monthZhi] === zhi) flags.push('月破');
    if (LIU_HE[monthZhi] === zhi) flags.push('月合');
    if (HAI[monthZhi] === zhi) flags.push('月害');
    return { state: state, score: YUE_SCORE[state], flags: flags };
  }

  // B 日辰层（辅·执行）：临/生/克/合/冲(暗动·日破)/墓/长生/帝旺/绝/害
  function dayLayer(zhi, dayZhi, isMoving, monthState) {
    var wx = ZHI_WX[zhi], dwx = ZHI_WX[dayZhi];
    var strong = (monthState === '旺' || monthState === '相');
    var flags = [], score = 0;
    if (dayZhi === zhi) { flags.push('日临'); score += RI_SCORE['日临']; }
    else if (SHENG_MAP[dwx] === wx) { flags.push('日生'); score += RI_SCORE['日生']; }
    else if (KE_MAP[dwx] === wx) { flags.push('日克'); score += RI_SCORE['日克']; }
    if (dayZhi !== zhi && LIU_HE[dayZhi] === zhi) { flags.push('日合'); score += RI_SCORE['日合']; }
    if (CHONG[dayZhi] === zhi) {
      if (isMoving) { flags.push(strong ? '动逢日冲(冲起)' : '动逢日冲(冲散)'); score += strong ? 1 : -2; }
      else if (strong) { flags.push('暗动'); score += RI_SCORE['暗动']; }
      else { flags.push('日破'); score += RI_SCORE['日破']; }
    }
    if (MU_KU[wx] === dayZhi) { flags.push('日墓'); score += RI_SCORE['日墓']; }
    if (dayZhi === csZhiOf(wx, 0)) { flags.push('日长生'); score += RI_SCORE['日长生']; }
    if (dayZhi === csZhiOf(wx, 4)) { flags.push('日帝旺'); score += RI_SCORE['日帝旺']; }
    if (dayZhi === csZhiOf(wx, 9)) { flags.push('日绝'); score += RI_SCORE['日绝']; }
    if (HAI[dayZhi] === zhi) { flags.push('日害'); score += RI_SCORE['日害']; }
    return { score: score, flags: flags };
  }

  // C 空亡层：由日辰定旬。空＝如无，不生不克，应期在出空/填空。
  // 「真空」＝彻底无用之爻。此处曾以 -999 作哨兵分数，compareRoles 却把它当普通分数做加减，
  // 致阵营净力出现 ±999 量级、淹没其余正常分数（见 tmp/audit_classics.js 项 A9）。
  // 现改为纯标记 void，由 yaoStrength 归零处理，力量对比量级恢复可控可比。
  function kongResolve(yao, monthState, dayFlags, isMoving) {
    if (!yao.isKong) return { state: '不空', score: 0, void: false, note: '' };
    var strong = (monthState === '旺' || monthState === '相');
    var riFu = dayFlags.some(function (f) {
      return f === '日临' || f === '日生' || f === '日合' || f === '日长生' || f === '日帝旺';
    });
    var riChong = dayFlags.some(function (f) { return f === '暗动' || f === '日破' || f.indexOf('动逢日冲') === 0; });
    if (riChong) return { state: '冲空出空', score: 0, void: false, note: '旬空逢日辰冲，冲空则实，当场变实有用' };
    if (yao.isYuePo && !riFu) return { state: '真空', score: 0, void: true, note: '旬空又月破且无日辰救应，空破并见，彻底无用' };
    if (!strong && !riFu) return { state: '真空', score: 0, void: true, note: '休囚之空又无日月生扶，谓之避空，到底无用' };
    if (isMoving) return { state: '动空', score: -1, void: false, note: '动不为空，待出旬或逢冲之日方见力' };
    return { state: '假空', score: -1, void: false, note: '旺相之空（旺空），出空填实之期方能用' };
  }

  // D 日月救应层：月建所定状态由日辰修正（日救月破/填实/合处逢冲/真破/日月合冲）
  function riyueResolve(chart) {
    var mz = chart.monthZhi, dz = chart.dayZhi;
    var mwx = ZHI_WX[mz], dwx = ZHI_WX[dz];
    var notes = [], rescue = {};
    // 月建与日辰：按用户裁定（依曲炜《六爻答疑》第二十一问"月建与日辰同功同权"），
    // 二者同属外部时间因素、层级相同，**不互论生克**，只各自与卦爻论生克冲合。
    // 若让月建与日辰互论会重复计算，并导致"月令失令"等自相矛盾。月日之间的生克冲合仅作气候背景。
    if (LIU_HE[mz] === dz) notes.push('月日六合（' + mz + dz + '）〔气候背景·不据以定旺衰〕：主和合、长久、事缓成');
    if (CHONG[mz] === dz) notes.push('月日六冲（' + mz + dz + '）〔气候背景·不据以定旺衰〕：主变动、反复、事速变或散');
    if (SHENG_MAP[mwx] === dwx) notes.push('月建生日辰〔气候背景·不据以定旺衰〕：月内气机顺、日力得助；仍须月建与日辰各自对卦爻论生克，再综合其作用于用神的力量');
    else if (KE_MAP[mwx] === dwx) notes.push('月建克日辰〔气候背景·不据以定旺衰〕：月内气机略受抑；仍以月建、日辰各自对卦爻的作用定旺衰');
    else if (mwx === dwx) notes.push('月日同气〔气候背景·不据以定旺衰〕：月建与日辰同气，各自对卦爻皆有作用，须分别论其生克冲合，不得因同气而径判极旺极衰');
    chart.ben.yaos.forEach(function (y) {
      var wx = ZHI_WX[y.zhi];
      if (LIU_HE[mz] === y.zhi && CHONG[dz] === y.zhi) {
        notes.push(y.posName + y.ganzhi + '：月合' + mz + '又逢日辰' + dz + '冲，合处逢冲，绊开');
      }
      if (!y.isYuePo) return;
      if (dz === y.zhi) { rescue[y.pos] = { state: '月破逢日辰填实', delta: 1, note: '月破得日辰临之，填实不以破论，爻有用' }; return; }
      var riSheng = (SHENG_MAP[dwx] === wx), riHe = (LIU_HE[dz] === y.zhi);
      if (riSheng || riHe) {
        rescue[y.pos] = { state: '月破得日救（' + (riSheng ? '日生' : '日合') + '）', delta: 1,
          note: '月破得日辰生合，出破／合破，不当真破论' };
        return;
      }
      var why = [];
      if (CHONG[dz] === y.zhi) why.push('冲');
      if (KE_MAP[dwx] === wx) why.push('克');
      if (MU_KU[wx] === dz) why.push('墓');
      if (dz === csZhiOf(wx, 9)) why.push('绝');
      rescue[y.pos] = { state: '真破', delta: -4,
        note: '月破又遇日辰' + (why.length ? why.join('') : '无生扶') + '，月内无用，出月或逢合方显力' };
    });
    return { notes: notes, rescue: rescue };
  }

  // D2 动变层：动爻化出之变爻回头作用于本爻（化进/退、回头生克合刑破、化墓化绝）
  /* 化进／化退：按《增删卜易·进神退神章》原表，不按 DIZHI 相邻下标。
   * 原文明文：
   *   进神：亥化子 寅化卯 巳化午 申化酉 丑化辰 辰化未 未化戌 戌化丑
   *   退神：子化亥 卯化寅 午化巳 酉化申 辰化丑 未化辰 戌化未 丑化戌
   * 口诀「四正四长隔位进，四墓循环别搞混」：四正（子亥/卯寅/午巳/酉申）为相邻一位，
   * 四长（丑辰/辰未/未戌/戌丑）亦为相邻；四墓（辰戌丑未）内部循环则按墓库顺逆。
   * 历史缺陷：此前用 DIZHI 下标 ±1 判定，只覆盖 8 组，四长（丑→辰、辰→未、未→戌、戌→丑）
   *          与其反向共 8 组全部漏判，故原书断「化进神／化退神」之爻引擎不认。
   */
  var JINSHEN_PAIRS = { '亥子': 1, '寅卯': 1, '巳午': 1, '申酉': 1, '丑辰': 1, '辰未': 1, '未戌': 1, '戌丑': 1 };
  var TUISHEN_PAIRS = { '子亥': 1, '卯寅': 1, '午巳': 1, '酉申': 1, '辰丑': 1, '未辰': 1, '戌未': 1, '丑戌': 1 };
  function huaLayer(y, by) {
    var wx = y.wuxing, bwx = by.wuxing;
    var flags = [], score = 0;
    if (JINSHEN_PAIRS[y.zhi + by.zhi]) { flags.push('化进'); }
    else if (TUISHEN_PAIRS[y.zhi + by.zhi]) { flags.push('化退'); }
    if (SHENG_MAP[bwx] === wx) { flags.push('回头生'); }
    else if (KE_MAP[bwx] === wx) { flags.push('回头克'); }
    else if (SHENG_MAP[wx] === bwx) { flags.push('化泄气'); }
    if (LIU_HE[by.zhi] === y.zhi) { flags.push('回头合'); }
    if (CHONG[by.zhi] === y.zhi) { flags.push('回头破'); }
    if (PO[by.zhi] === y.zhi) { flags.push('化破'); }
    if (MU_KU[wx] === by.zhi) { flags.push('化墓'); }
    if (by.zhi === csZhiOf(wx, 9)) { flags.push('化绝'); }
    var xingHit = (y.zhi === by.zhi && ZI_XING.indexOf(y.zhi) >= 0) ||
      XING.some(function (g) { return g.zhi.indexOf(y.zhi) >= 0 && g.zhi.indexOf(by.zhi) >= 0; });
    if (xingHit) { flags.push('回头刑'); }
    flags.forEach(function (f) { if (HUA_SCORE[f] !== undefined) score += HUA_SCORE[f]; });
    return { flags: flags, score: score };
  }

  // ==================== 爻的四个层次与爻际作用（曲炜《六爻详真》，本于李洪成三层次）====================
  // 【为什么本层必须下沉为逻辑，而不能写成提示词条款】
  //   上一轮「避空／贪生忘克」的做法是：净力照旧按老算法算，只在净力之外**附加一句说明**。
  //   消融实验（tmp/消融实验报告_避空与贪生忘克.md）实测：模型采信本组引擎净力 0/8，
  //   它拿分项分数自行重算，附加说明被完全绕开；且加了条款后断语质量反而下降。
  //   本层性质不同：它改的是**分项数字本身**——低层次爻无权作用高层次爻时，其对外作用力
  //   直接按零计入，引擎交给模型的就是过滤后的数字，模型再重算也只能是过滤后的结果。
  //   ⇒ 通则：能下沉为数字的必须下沉；只有无法下沉者（取象、措辞）才交给提示词。
  //
  // 【层次＝生克权（权力），旺衰＝自身强弱（力量），二者是独立维度】
  //   一、日月建（第一层次）：对卦中任何爻都有生克权；卦中之爻无权生克日月。
  //   二、变爻（第二层次）：动爻在变卦中的同位爻。可生克主卦动爻与静爻；
  //       主卦动爻、静爻无权生克变爻。
  //   三、动爻与暗动之爻（第三层次）：可生克同层次动爻，亦可生克静爻；
  //       无权生克日月与变爻。
  //   四、静爻含伏藏（第四层次）：只能生克同层次静爻，不能生克动爻。
  //       动爻被克时静爻根本不能通关——"即使静爻临日、月，也是无奈"。
  //   层次转换：值日月之静爻"有第一层次之力，无第一层次之权"，仍无权生克动爻
  //       （曲炜答疑反复澄清的常见误区：力量≠权力）。
  var LAYER = { RIYUE: 1, BIAN: 2, DONG: 3, JING: 4 };
  var LAYER_NAME = { 1: '日月建', 2: '变爻', 3: '动爻（含暗动）', 4: '静爻（含伏藏）' };

  // 本卦爻的层次（变爻作为独立实体时用 _layer 显式指定为 2）
  function layerOf(y) {
    if (!y) return null;
    if (y._layer) return y._layer;
    if (y.isMoving) return LAYER.DONG;
    if (y.wang && y.wang.dayFlags && y.wang.dayFlags.indexOf('暗动') >= 0) return LAYER.DONG;
    return LAYER.JING;
  }

  // 生克权：高层次（数字小）可作用低层次，同层次可互作用，低层次无权作用高层次。
  // 这是本层唯一的闸门，也是"静爻不能生动爻""动爻不能克变爻"的机械来源。
  function hasPower(from, to) {
    var a = layerOf(from), b = layerOf(to);
    if (a === null || b === null) return false;
    return a <= b;
  }

  // 合冲刑害次序（曲炜答疑第十六问）：同层次爻按 合>冲>刑>害>无特殊关系之生克 取**唯一**
  // 关系（不平权累加）；层次不同时次序被打乱，低层次爻的刑冲合害一律让位于高层次爻。
  var REL_PRIORITY = ['合', '冲', '刑', '害', '生', '克'];
  function relBetween(a, b) {
    if (!a || !b || a === b) return null;
    var za = a.zhi, zb = b.zhi, wa = a.wuxing, wb = b.wuxing;
    var found = [];
    if (LIU_HE[za] === zb) found.push('合');
    if (CHONG[za] === zb) found.push('冲');
    var xing = (za === zb && ZI_XING.indexOf(za) >= 0) ||
      XING.some(function (g) { return g.zhi.indexOf(za) >= 0 && g.zhi.indexOf(zb) >= 0; });
    if (xing) found.push('刑');
    if (HAI[za] === zb) found.push('害');
    // 生克方向：'生我'＝对方生我（于我有利）；'我生'＝我泄气；'克我'＝我受克；'我克'＝我施克
    if (SHENG_MAP[wb] === wa) found.push('生我');
    else if (SHENG_MAP[wa] === wb) found.push('我生');
    else if (KE_MAP[wb] === wa) found.push('克我');
    else if (KE_MAP[wa] === wb) found.push('我克');
    if (!found.length) return null;
    // 生克需归一到 REL_PRIORITY 的 '生'/'克' 名下再比优先级，方向另存
    var dirMap = { 生我: '生', 我生: '生', 克我: '克', 我克: '克' };
    var rel = null, dir = null;
    for (var i = 0; i < REL_PRIORITY.length; i++) {
      var p = REL_PRIORITY[i];
      var hit = found.filter(function (f) { return f === p || dirMap[f] === p; })[0];
      if (hit) { rel = p; dir = dirMap[hit] || hit; break; }
    }
    if (!rel) return null;
    // rawDir 保留四向（生我/我生/克我/我克），供"对谁有利"的定向判定；视角为 a
    return { rel: rel, dir: dir, rawDir: (dirMap[hit] ? hit : rel), raw: found };
  }

  // 变爻旁爻（第二层次的作用定向，曲炜）：变爻对本位动爻有生克合冲时，因距离最近有优先权，
  // 此时只作用本位动爻、不顾旁爻；只有对本位动爻**无**生克合冲关系时，才转去作用主卦其它旁爻。
  // 作用次序（鋈子一脉，与曲炜互补）：优先其它动爻 → 用神 → 世爻／应爻。
  var HUA_SELF_REL = ['化进', '化退', '回头生', '回头克', '回头合', '回头破', '化破', '化墓', '化绝', '回头刑', '化泄气'];
  function bianPangLayer(chart) {
    var out = [];
    if (!chart || !chart.bian || !chart.bian.yaos) return out;
    chart.ben.yaos.forEach(function (y, i) {
      if (!y.isMoving || !y.hua) return;
      var by = chart.bian.yaos[i];
      if (!by) return;
      by._layer = LAYER.BIAN; // 变爻为第二层次：可作用主卦动爻与静爻，反之不可
      var selfRel = y.hua.flags.filter(function (f) { return HUA_SELF_REL.indexOf(f) >= 0; });
      if (selfRel.length) {
        out.push({ from: y.posName, bian: by.posName + by.zhi, bianYao: by, onlySelf: true, selfRel: selfRel, targets: [] });
        return;
      }
      // 无回头关系 → 变爻可作用于主卦旁爻（先动爻，后静爻；用神与世应在 compareRoles 中定向）
      var targets = [];
      chart.ben.yaos.forEach(function (o) {
        if (o === y) return;
        var r = relBetween(by, o);
        if (!r || !r.rel) return;
        targets.push({ pos: o.posName, zhi: o.zhi, liuqin: o.liuqin, rel: r.rel, dir: r.dir, rawDir: r.rawDir,
          isMoving: !!o.isMoving, isShi: !!o.isShi, isYing: !!o.isYing });
      });
      out.push({ from: y.posName, bian: by.posName + by.zhi, bianYao: by, onlySelf: false, selfRel: [], targets: targets });
    });
    return out;
  }

  // 变爻旁爻【叠加】：把上面的定向结果直接写进目标爻的力量分数与痕迹，
  // 而不是只在阵营净力之外挂一项——这样引擎输出的**每一个数字**都已含该作用，
  // 模型无从剔除，也无从靠"拿分项自己加一遍"绕开。
  // 调用时机：必须在全部爻基础分算完之后（否则取不到目标爻的 wang）。
  function bianPangApply(chart) {
    if (!chart || !chart._bianPang || !ABLATION.yaoLayer) return [];
    var applied = [];
    chart._bianPang.forEach(function (bp) {
      if (bp.onlySelf || !bp.bianYao) return;
      var bf = bp.bianYao.wang ? bp.bianYao.wang.score : 0;
      bp.targets.forEach(function (t) {
        var target = null;
        for (var i = 0; i < chart.ben.yaos.length; i++) {
          if (chart.ben.yaos[i].posName === t.pos) { target = chart.ben.yaos[i]; break; }
        }
        if (!target || !target.wang) return;
        // 真空之爻已判彻底无用（出不出空皆无生克权），受生受克皆起不来，不得再被叠加抬起。
        // 此与"三合成局增力"曾误抬真空爻属同一类缺陷：任何加分都须在真空判定之后让路。
        if (target.wang.kong === '真空') return;
        var d = 0, word = '';
        if (t.rel === '合') { d = bf >= 1 ? 1 : -1; word = bf >= 1 ? '合起' : '合绊'; }
        else if (t.rel === '冲') { d = bf >= 1 ? 1 : -2; word = bf >= 1 ? '冲起' : '冲散'; }
        else if (t.rel === '刑') { d = -1; word = '相刑'; }
        else if (t.rel === '害') { d = -1; word = '相害'; }
        else if (t.rawDir === '我生') { d = Math.min(2, Math.max(1, bf)); word = '生之'; }
        else if (t.rawDir === '我克') { d = -Math.min(2, Math.max(1, bf)); word = '克之'; }
        else if (t.rawDir === '生我') { d = -1; word = '为其所生而泄气'; }
        else if (t.rawDir === '克我') { d = -1; word = '为其所克而耗力'; }
        if (!d) return;
        target.wang.score += d;
        target.wang.level = lvOfScore(target.wang.score);   // 分数改了，等级须同步
        target.wang.bianPang = (target.wang.bianPang || 0) + d;
        target.wang.marks.push('变爻' + bp.bian + '转作用于旁爻·' + t.rel + '·' + word + '（' + (d > 0 ? '+' : '') + d + '）');
        applied.push({ pos: t.pos, bian: bp.bian, rel: t.rel, delta: d });
      });
    });
    return applied;
  }

  // ===== 爻际量化的对外入口：幂等，可反复重算 =====
  // 时序：用神须先定（忌神不得用事只针对用神），故本步不在装卦内跑完，而由上层在用神解析后调用。
  // 幂等性靠 _preInterScore/_preInterMarks 快照回滚保证——重复调用绝不累加，
  // 消融实验切换开关后重跑此步即可得到新数字（不必重排盘）。
  function applyInterYao(chart, useLq) {
    if (!chart || !chart.ben || !chart.ben.yaos) return chart;
    function rollback() {
      chart.ben.yaos.forEach(function (y) {
        if (!y.wang || y._preInterScore === undefined) return;
        y.wang.score = y._preInterScore;
        y.wang.marks = y._preInterMarks.slice();
        y.wang.level = levelOf(y.wang);   // 真空判定优先，不得被回滚冲掉
        y.wang.interYao = 0;
        y._isUseGod = false; y._jsHold = false;
      });
      chart._jsHold = null;
    }
    // 「用神取哪一爻」取决于旺衰分（六亲两现时取旺相者），而旺衰分又取决于
    // "忌神是否不得用事"——而这一条只对用神生效。二者互为因果，故做收敛迭代：
    // 先按未含爻际之分选一次，应用后重选，若选中之爻变了则回滚重算，至多三轮（实践中两轮即稳）。
    var prev = null;
    for (var pass = 0; pass < 3; pass++) {
      var nowYs = useLq ? pickLqYao(chart, useLq) : null;
      if (pass > 0 && nowYs === prev) break;
      prev = nowYs;
      rollback();
      if (useLq && chart.ben.info) {
        var yj = liuqinYuanJi(chart.ben.info.element, useLq);
        if (yj) {
          var ys = pickLqYao(chart, useLq);
          var js = pickLqYao(chart, yj.ji);
          var yuan = pickLqYao(chart, yj.yuan);
          chart._jsHold = jsHoldResolve(ys, js, yuan);
          if (ys) ys._isUseGod = true;
          if (js && !chart._jsHold.active) js._jsHold = true;   // 忌神不得用事：克用之力按零计
        }
      }
      chart._interYaoApplied = interYaoApply(chart);
    }
    return chart;
  }

  // ===== 爻际关系量化（下沉核心）=====
  // 次序（曲炜答疑第十六问）：同层次爻按 合>冲>刑>害>无特殊关系之生克 取**唯一**关系，不平权累加；
  //   层次不同时低层次爻的刑冲合害一律让位于高层次（由 hasPower 闸门实现）。
  // 权值不是常数而是**条件函数**（典籍只给次序与性质，不给数字；数字属工程近似，须消融验证）：
  //   合／冲的正负取决于**被合被冲之爻**的旺衰——旺则合起、冲起，衰则合绊、冲散（"用神旺相被冲为冲起，
  //   休囚被冲为冲散"）；生克的作用力度取决于**施力之爻**的旺衰；刑害恒定 −1。
  //   合住则不克：唯一关系已由 relBetween 取定，合优先于生克，故天然是**替代**而非叠加，不会算两次。
  function relWeight(rel, rawDir, forceFrom, forceTo) {
    if (rel === '合') return forceTo >= 1 ? 1 : -1;                              // 合起／合绊
    if (rel === '冲') return forceTo >= 1 ? 1 : -2;                              // 冲起／冲散
    if (rel === '刑') return -1;
    if (rel === '害') return -1;
    if (rawDir === '生我') return Math.min(2, Math.max(1, forceFrom));           // 受生，得力
    if (rawDir === '克我') return -Math.min(2, Math.max(1, forceFrom));          // 受克，受损
    if (rawDir === '我生') return -1;                                            // 我生彼，泄气
    if (rawDir === '我克') return -1;                                            // 我克彼，耗力
    return 0;
  }
  var REL_WORD = { 合起: '合起', 合绊: '合绊', 冲起: '冲起', 冲散: '冲散' };
  function relWord(rel, w) {
    if (rel === '合') return w > 0 ? '合起' : '合绊';
    if (rel === '冲') return w > 0 ? '冲起' : '冲散';
    if (rel === '刑') return '相刑';
    if (rel === '害') return '相害';
    return '';
  }
  // 爻际损益：两轮传导。第一轮以本体分算，第二轮以第一轮结果重算后**替换**（不累加），
  // 使"仇神生忌神→忌神更强→克用更重"这类链式传导得以体现，否则仇神只助忌神、不损用神。
  function interYaoApply(chart) {
    if (!chart || !chart.ben || !chart.ben.yaos || !ABLATION.interYao) return [];
    var yaos = chart.ben.yaos, n = yaos.length, i, j, k;
    var base = [], cur = [];
    for (i = 0; i < n; i++) { base.push(yaos[i].wang ? yaos[i].wang.score : 0); cur.push(base[i]); }
    var d = null, trace = [];
    for (var round = 0; round < 2; round++) {
      d = []; for (k = 0; k < n; k++) d.push(0);
      var rt = [];
      for (i = 0; i < n; i++) {
        for (j = 0; j < n; j++) {
          if (i === j) continue;
          var a = yaos[i], b = yaos[j];
          if (!a.wang || !b.wang) continue;
          if (a.wang.kong === '真空') continue;      // 真空短路：无生克权
          if (b.wang.kong === '真空') continue;      // 真空之爻受生受克皆起不来
          // 以受力爻 b 为"我"取关系，rawDir 才对应"b 受生／受克／泄气／耗力"
          var r = relBetween(b, a);
          if (!r || !r.rel) continue;
          // 忌神不得用事（避空／贪生忘克）——此前只作提示词条款，模型采信率 0；
          //   爻际量化层建起后终于可下沉：忌神对用神的**克用之力**按零计，模型自算亦得同一结果。
          //   只剔"克我"，不剔合冲刑害：典籍原文是"不以其力克用""不再克用神"，
          //   若连忌神与用神的"合"一并剔除，反会把有利的合起也抹掉（实测反向 1909 例之由）。
          if (a._jsHold && b._isUseGod && r.rawDir === '克我') continue;
          // 层次闸门（受 yaoLayer 开关控制，关掉则静爻亦可作用动爻，回到改造前行为）
          if (ABLATION.yaoLayer && !hasPower(a, b)) continue;
          // 施力资格：生克只由动爻（含暗动）发出——静爻之间生克力弱，只作环境补充，
          //   若一并计入会让每爻背负数条 ±2 的作用，量级爆炸（实测每爻 5 条、损益达 −6）。
          //   合冲刑害是结构关系，静爻之间照样论，但权值本身已小（±1／−2）。
          // 泄气（我生）与耗力（我克）不计入力量分：传统旺衰从不以此评分，计入即失真。
          if ((r.rawDir === '生我' || r.rawDir === '克我') && layerOf(a) > LAYER.DONG) continue;
          if (r.rawDir === '我生' || r.rawDir === '我克') continue;
          var w = relWeight(r.rel, r.rawDir, cur[i], cur[j]);
          if (!w) continue;
          d[j] += w;
          rt.push({ from: i, to: j, w: w, rel: r.rel, rawDir: r.rawDir });
        }
      }
      for (k = 0; k < n; k++) cur[k] = base[k] + d[k];
      trace = rt;
    }
    // 一次性写回（每爻只加减一次合计值，同一作用绝不重复计入）
    var applied = [];
    for (k = 0; k < n; k++) {
      var y = yaos[k];
      if (!y.wang || !d[k]) continue;
      if (y.wang.kong === '真空') continue;   // 铁律：任何加分都须在真空判定之后让路
      y.wang.score += d[k];
      y.wang.level = levelOf(y.wang);
      y.wang.interYao = d[k];
    }
    trace.forEach(function (t) {
      var b = yaos[t.to];
      if (!b.wang) return;
      if (['合', '冲', '刑', '害'].indexOf(t.rel) >= 0) {
        b.wang.marks.push('爻' + yaos[t.from].idx + '·' + relWord(t.rel, t.w) + '（' + (t.w > 0 ? '+' : '') + t.w + '）');
      } else if (t.rawDir === '生我') {
        b.wang.marks.push('受爻' + yaos[t.from].idx + '之生（+' + t.w + '）');
      } else if (t.rawDir === '克我') {
        b.wang.marks.push('受爻' + yaos[t.from].idx + '之克（' + t.w + '）');
      }
      applied.push({ from: yaos[t.from].idx, to: yaos[t.to].idx, rel: t.rel, delta: t.w });
    });
    return applied;
  }

  // 有效作用力：一爻对他爻的实际作用，须同时过「真空无生克权」与「层次生克权」两道闸门。
  // 这是阵营净力的计算基元——过滤发生在数字生成环节，故模型无法靠自算绕过。
  function effForce(from, to) {
    if (!from || !to) return 0;
    if (from.wang && from.wang.kong === '真空') return 0;  // 真空：出不出空皆无生克权
    if (!hasPower(from, to)) return 0;                     // 低层次无权作用高层次
    return (from.wang ? from.wang.score : 0);
  }

  // 等级：真空判定优先于分数分档（任何后续叠加都不得把真空爻改回普通等级）
  function levelOf(wang) {
    if (!wang) return '';
    return (wang.kong === '真空') ? '真空（无用）' : lvOfScore(wang.score);
  }

  // 力量分档（抽出以便后续叠加变爻旁爻后重算等级，避免分数改了等级没跟上）
  function lvOfScore(score) {
    if (score >= 5) return '极旺';
    if (score >= 3) return '旺相';
    if (score >= 1) return '有气';
    if (score === 0) return '中性';
    if (score >= -3) return '衰弱';
    return '极衰';
  }

  // E 综合：逐爻 属性赋值 → 力量加减
  function yaoStrength(y, chart) {
    var ml = monthLayer(y.zhi, chart.monthZhi);
    var dl = dayLayer(y.zhi, chart.dayZhi, !!y.isMoving, ml.state);
    var kong = kongResolve(y, ml.state, dl.flags, !!y.isMoving);
    var marks = [], score = 0;

    score += ml.score;
    marks.push('月建' + ml.state);
    ml.flags.forEach(function (f) {
      marks.push(f);
      if (f === '月破') score += YUE_PO;
      else if (f === '月合') score += (ml.state === '旺' || ml.state === '相') ? 1 : -1;
      else if (f === '月害') score -= 1;
    });

    if (chart.riyue && chart.riyue.rescue[y.pos] && y.isYuePo) {
      var r = chart.riyue.rescue[y.pos];
      score -= YUE_PO;
      score += r.delta;
      marks.push(r.state);
    }

    score += dl.score;
    dl.flags.forEach(function (f) { marks.push(f); });

    if (y.hua) { score += y.hua.score; y.hua.flags.forEach(function (f) { marks.push(f); }); }
    if (y.isMoving) { score += 1; marks.push('发动'); }

    if (kong.state !== '不空') marks.push('旬空·' + kong.state);
    // 真空＝彻底无用：力量按零计（不再把哨兵值混入分数运算，量级保持可比）
    if (kong.void) { score = 0; marks.push('真空·无生克权（力量按零计）'); }
    else score += kong.score;

    // 三合/三会成局：局成则局内之爻得局势之助，力量先增（"先有三合六合、再论旺衰"）。
    // 增力为简化：入成局之爻一律 +2；更精细的"局五行定向生克"为后续项。
    // 真空之爻已判彻底无用，入局亦不增力（否则 score 先归零又被 +2 抬起，违反"真空无力"）。
    // 增力值由成局判定给出（三合局 +2、三会方局 +1；半合／不成／破局一律不给增力）
    if (chart._juZhi && chart._juZhi[y.zhi] && !kong.void) {
      score += chart._juZhi[y.zhi];
      marks.push('入' + (chart._juZhi[y.zhi] >= 2 ? '三合局' : '三会方局') + '增力+' + chart._juZhi[y.zhi]);
    }

    var level = (kong.state === '真空') ? '真空（无用）' : lvOfScore(score);

    return { score: score, level: level, marks: marks,
      monthState: ml.state, dayFlags: dl.flags, kong: kong.state, kongNote: kong.note };
  }

  // ===== 消融开关（A/B 对照实验用；默认全开＝生产行为）=====
  // relationRules=false 时关闭"避空""贪生忘克"两条《卜筮正宗》关系规则，回退为纯分数对比。
  // 注意：A9（真空哨兵值归零）是**纯 bug 修复**，不属于可消融的规则，任何开关下都保持生效。
  // yaoLayer=false 时关闭「爻层次／变爻旁爻／合冲刑害次序」三条结构规则，
  //   阵营加减回退为各爻自身旺衰分（改动前的历史行为）。
  // layerWords=false 时**只关说明文字、数字照旧过滤**——用于检验"改数字"本身是否已足够，
  //   即把【有效作用力】与【层次裁定】等文字说明全部撤掉，只留过滤后的数字。
  //   三条路径彼此独立，才能做 2×2 消融（数字 × 文字）。
  // interYao=false 时关闭「爻际合冲刑害与生克」的量化下沉，各爻分数回退为只含日月化动空局旁爻，
  //   阵营加减恢复在净力层做（改动前的历史行为）。
  var ABLATION = { relationRules: true, yaoLayer: true, layerWords: true, interYao: true };
  function setAblation(flags) {
    if (flags && typeof flags.relationRules === 'boolean') ABLATION.relationRules = flags.relationRules;
    if (flags && typeof flags.yaoLayer === 'boolean') ABLATION.yaoLayer = flags.yaoLayer;
    if (flags && typeof flags.layerWords === 'boolean') ABLATION.layerWords = flags.layerWords;
    if (flags && typeof flags.interYao === 'boolean') ABLATION.interYao = flags.interYao;
    return ABLATION;
  }

  // 六亲（六爻两现时的取舍）：动爻优先 → 持世次之 → 旺相者；空破者最后。
  // 抽到模块级以便装卦阶段与比较阶段共用同一选取口径（单一来源）。
  function pickLqYao(chart, lq) {
    if (!lq || !chart || !chart.ben) return null;
    var list = chart.ben.yaos.filter(function (y) { return y.liuqin === lq; });
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    function rank(y) {
      return (y.isMoving ? 100 : 0) + (y.isShi ? 50 : 0) +
        (y.wang ? y.wang.score : 0) * 2 - ((y.isKong || y.isYuePo) ? 200 : 0);
    }
    return list.slice().sort(function (a, b) { return rank(b) - rank(a); })[0];
  }

  // 忌神不得用事的两条例外（《卜筮正宗·原忌仇神论第四》＋ 空亡家"避空"说）——单一来源，
  // 装卦阶段据此把"不得用事"下沉为数字（爻际量化时剔除该作用），比较阶段据此出条款文字。
  function jsHoldResolve(ys, js, yuan) {
    var ysKongState = (ys && ys.isKong && ys.wang && ys.wang.kong) ? ys.wang.kong : '不空';
    var out = { active: true, note: null, state: ysKongState };
    if (!ABLATION.relationRules) return out;
    if (js && js.isMoving && ysKongState !== '不空') {
      out.active = false;
      out.note = '避空：用神旬空（' + ysKongState + '）而忌神独发——旬空之爻在旬内无生克权，'
        + '忌神不得用事，故不以其力克用；此反为吉兆，非"用神被克"。应期取用神出空填实或逢冲之日。';
    } else if (js && yuan && js.isMoving && yuan.isMoving) {
      out.active = false;
      out.note = '贪生忘克：忌神发动而原神亦动，忌神转生原神、不再克用神，用神根蒂深固（其吉更倍）。';
    }
    return out;
  }

  // F 比较：用神 vs 忌神、世 vs 应；含 用神两现取舍 与 世应空破判定
  function compareRoles(chart, roles) {
    roles = roles || {};
    var pick = function (lq) { return pickLqYao(chart, lq); };
    function shuangXian(lq, chosen) {
      if (!lq || !chosen) return null;
      var list = chart.ben.yaos.filter(function (y) { return y.liuqin === lq; });
      if (list.length < 2) return null;
      var reason = chosen.isMoving ? '取发动之爻（动而有用，事之所因）'
        : (chosen.isShi ? '取持世之爻（与我切身）'
          : '取旺相者（旬空月破者不作主用）');
      return { lq: lq, count: list.length, chosen: chosen.posName + chosen.ganzhi, reason: reason,
        others: list.filter(function (y) { return y !== chosen; })
          .map(function (y) { return y.posName + y.ganzhi; }) };
    }
    function sc(y) { return (y && y.wang) ? y.wang.score : null; }
    var ys = pick(roles.yongshen), js = pick(roles.jishen), yuan = pick(roles.yuanshen), chou = pick(roles.choushen);
    var shi = chart.ben.yaos.filter(function (y) { return y.isShi; })[0];
    var ying = chart.ben.yaos.filter(function (y) { return y.isYing; })[0];
    var out = { yongshen: ys, jishen: js, yuanshen: yuan, choushen: chou, shi: shi, ying: ying,
      ysScore: sc(ys), jsScore: sc(js), yuanScore: sc(yuan), chouScore: sc(chou), shiScore: sc(shi), yingScore: sc(ying),
      shuangXian: shuangXian(roles.yongshen, ys), shiYingKongPo: [], verdict: [] };
    // 世应空破：世应生克力大减，只作趋势参考
    if (shi && (shi.isKong || shi.isYuePo)) {
      out.shiYingKongPo.push('世爻' + shi.posName + shi.ganzhi +
        (shi.isKong ? '旬空' : '') + (shi.isYuePo ? '月破' : '') +
        '（我方无力，事难由我主导；世应生克只作趋势参考）');
    }
    if (ying && (ying.isKong || ying.isYuePo)) {
      out.shiYingKongPo.push('应爻' + ying.posName + ying.ganzhi +
        (ying.isKong ? '旬空' : '') + (ying.isYuePo ? '月破' : '') +
        '（所问之事虚而不实或对方无意；世应生克只作趋势参考）');
    }
    if (ys && out.ysScore !== null) {
      // —— 有效作用力：过「真空无生克权」＋「爻层次生克权」两道闸门 ——
      // 过滤发生在数字生成环节，故 out.yuanEff/jsEff/chouEff 交给模型的即过滤后的值，
      // 模型自行重算也只能得到过滤后的结果（避空／贪生忘克之鉴：附加文字说明可被绕开，数字不可）。
      var useLayer = ABLATION.yaoLayer;
      var yuanS = useLayer ? effForce(yuan, ys) : (out.yuanScore == null ? 0 : out.yuanScore);
      var jsS = useLayer ? effForce(js, ys) : (out.jsScore == null ? 0 : out.jsScore);
      var chouS = useLayer ? effForce(chou, js || ys) : (out.chouScore == null ? 0 : out.chouScore);
      out.yuanEff = yuanS; out.jsEff = jsS; out.chouEff = chouS;
      // layerWords 只关"说明文字"，不过滤数字——用于隔离「改数字」与「加说明」两个变量
      var words = ABLATION.layerWords;
      if (useLayer && words) {
        if (js && !hasPower(js, ys)) {
          out.verdict.push('爻层次：忌神' + js.posName + js.ganzhi + '为' + LAYER_NAME[layerOf(js)] +
            '，用神' + ys.posName + ys.ganzhi + '为' + LAYER_NAME[layerOf(ys)] +
            '——低层次爻无权生克高层次爻，其克用之力按零计（曲炜《六爻详真》爻之四层次）。');
        }
        if (yuan && !hasPower(yuan, ys)) {
          out.verdict.push('爻层次：原神' + yuan.posName + yuan.ganzhi + '为' + LAYER_NAME[layerOf(yuan)] +
            '，用神为' + LAYER_NAME[layerOf(ys)] + '——静爻不能为动爻通关，其生用之力按零计'
            + '（书云"当动爻被克时，静爻根本不能起到通关作用，即使静爻临日、月也是无奈"）。');
        }
        // 值日月之静爻：有第一层次之力，无第一层次之权（力量≠权力）
        [['忌神', js], ['原神', yuan]].forEach(function (p) {
          if (p[1] && !p[1].isMoving && (p[1].zhi === chart.dayZhi || p[1].zhi === chart.monthZhi)) {
            out.verdict.push('层次转换：' + p[0] + p[1].posName + p[1].zhi + '值' +
              (p[1].zhi === chart.dayZhi ? '日辰' : '月建') +
              '，有第一层次之力而无第一层次之权——自身旺相，仍无权生克动爻、变爻。');
          }
        });
      }
      // —— 忌神不得用事的两条例外（《卜筮正宗·原忌仇神论第四》＋ 空亡家"避空"说）——
      // 避空：用神旬空而忌神独发。旬空之爻在旬内本无生克权（空亡家："休囚之爻在旬期间为之避空，
      //       出不出空都无生克权"），故忌神无从施其力，此反为吉兆，不可以"用神被克"论。
      // 贪生忘克：忌神动而原神亦动，忌神转生原神、不再克用，用神根蒂深固，书称"其吉更倍"。
      // 复用装卦阶段已算好的判定（chart._jsHold），保证「下沉的数字」与「出给模型的文字」同源
      var hold = chart._jsHold || jsHoldResolve(ys, js, yuan);
      var jsActive = hold.active, jsHoldNote = hold.note;
      var ysKongState = hold.state;
      // —— 合冲刑害次序（曲炜答疑第十六问）——
      // 同层次爻按 合>冲>刑>害>无特殊关系之生克 取唯一关系，不平权累加；
      // 层次不同时次序被打乱，低层次爻的刑冲合害一律让位于高层次爻。
      if (useLayer && js && ys) {
        var rj = relBetween(js, ys);
        if (rj) {
          out.relOrder = rj;
          out.verdict.push('作用次序（忌神↔用神）：两爻间同时存在「' + rj.raw.join('、') +
            '」，按"合>冲>刑>害>无特殊关系之生克"取唯一关系＝' + rj.rel +
            (layerOf(js) !== layerOf(ys)
              ? '；且两爻层次不同（忌神' + LAYER_NAME[layerOf(js)] + '／用神' + LAYER_NAME[layerOf(ys)] + '），低层次之刑冲合害让位于高层次'
              : '') + '。');
        }
      }
      // —— 变爻旁爻（第二层次的作用定向）——
      // 变爻对本位动爻无生克合冲时，转去作用主卦旁爻（先动爻，后用神，再世应）；
      // 命中用神则其力计入阵营净力。
      // 变爻旁爻的作用已由 bianPangApply **直接写进目标爻的力量分数**（下沉原则），
      // 此处只出说明，不再重复计入净力——否则同一作用会被算两次。
      var bianPangDelta = 0;
      if (useLayer && ys && ys.wang && ys.wang.bianPang) {
        bianPangDelta = ys.wang.bianPang;
        if (words) out.verdict.push('变爻旁爻：卦中有变爻对本位动爻无生克合冲，转作用于用神' + ys.posName + ys.zhi +
          '，其力已计入用神分数之内（合计 ' + (bianPangDelta > 0 ? '+' : '') + bianPangDelta + '）。');
      }
      out.bianPangDelta = bianPangDelta;

      var jsEff = jsActive ? jsS : 0;
      // 净力口径：爻际作用下沉后，用神分数里**已经包含**原神之生、忌神之克、以及合冲刑害，
      //   故净力＝用神综合值，阵营层不再重复加减（同一作用绝不算两次）。
      // 未下沉时（interYao=false）回退旧式：用神 + 原神 − 忌神 − 仇神。
      var net = ABLATION.interYao ? out.ysScore : (out.ysScore + yuanS - jsEff - chouS);
      // 净力是全局总判，必须以数字字段透出（铁律：引擎算了但没透出字段＝等于没算）。
      // 此前只写进 verdict 文本，调用方只能靠正则抠字，既脆弱又无从让模型把它当唯一裁决量。
      out.net = net; out.jsActive = jsActive; out.netMode = ABLATION.interYao ? '用神综合值（含爻际）' : '阵营加减（旧式）';
      if (out.jsScore !== null && jsActive) {
        if (ABLATION.interYao) {
          // 爻际下沉后，忌神克用之力已折算进用神综合值。此处若再拿两个自身分比一次，
          // 既是同一作用算两次，又会与净力结论打架（实测同卦出现"弱于忌神凶象／综合值吉象"并列）。
          // 故改为只报忌神本爻之值并声明不得再加减。
          out.verdict.push('忌神' + js.posName + js.ganzhi + '＝' + out.jsScore
            + '（本爻自身旺衰，仅备取象；其克用之力已折算进用神综合值，不得再加减一次）');
        } else if (out.ysScore > out.jsScore) out.verdict.push('用神力量强于忌神，吉象');
        else if (out.ysScore < out.jsScore) out.verdict.push('用神力量弱于忌神，凶象');
        else out.verdict.push('用神与忌神力量相当，事在两可，须看动爻导向');
      }
      if (jsHoldNote) out.verdict.push(jsHoldNote);
      if (js && js.isKong && js.wang && js.wang.kong === '真空') {
        out.verdict.push('忌神真空：书云"原用两神不宜空，忌神宜空"，此忌神徒有其名而无生克权，不能为祸，反主吉。');
      }
      if (ysKongState === '真空') {
        out.verdict.push('用神真空：休囚之空又无日月救应，彻底无用（不只是力量弱），出不出空皆不成事，须查本宫伏神或待填实之期。');
      }
      if (chou && out.chouScore !== null && out.chouScore >= 1) {
        out.verdict.push('仇神（' + roles.choushen + '）有力，生助忌神、凶上加凶');
      }
      if (out.ysScore <= -4) out.verdict.push('用神极衰，纵有生扶亦难起');
      if (out.yuanScore !== null && out.yuanScore <= -3 && out.ysScore < 1) out.verdict.push('原神衰又用神无气，凶上加凶');
      // 三合/三会成局：用神/忌神入局则旺衰须以局重论（局成先增力，已在 yaoStrength 计入）
      if (chart._juZhi) {
        if (ys && chart._juZhi[ys.zhi]) out.verdict.push('用神入三合/三会成局，力量已按局重估（局成增力），旺衰须以局论，不得单看日月');
        if (js && chart._juZhi[js.zhi]) out.verdict.push('忌神入三合/三会成局，凶力因局增大，宜重点防范');
      }
      // 阵营净力综合判定（用神+原神 − 忌神−仇神）
      var netLabel = ABLATION.interYao
        ? '用神综合值（已含原神之生、忌神之克及合冲刑害）'
        : '阵营净力（用神+原神 − 忌神' + (jsActive ? '' : '（忌神不得用事，未计克用之力）') + '−仇神）';
      var netWord = ysKongState === '真空' ? '：用神真空，净力不作总判，直判不成'
        : (net > 0 ? '：助用阵营占优，吉象' : (net < 0 ? '：忌神阵营占优，凶象' : '：势均力敌，须看动爻与应期'));
      out.verdict.push(netLabel + '＝ ' + net + netWord);
    }
    if (shi && ying && out.shiScore !== null && out.yingScore !== null) {
      if (out.shiScore > out.yingScore) out.verdict.push('世强应弱，我方得势、可控');
      else if (out.shiScore < out.yingScore) out.verdict.push('世弱应强，我方被动、受制于外');
      else out.verdict.push('世应均等，各不相下');
    }
    out.shiYingKongPo.forEach(function (s) { out.verdict.push(s); });
    return out;
  }

  // 用神生克图（引擎级单一来源）：基于用神六亲，按本卦卦宫五行实算原神/忌神/仇神，
  // 调用 compareRoles 实算用神/原神/忌神/仇神爻与力量对比判定
  function getUseGodRelation(chart, useLq) {
    if (!useLq) return null;
    var el = chart && chart.ben && chart.ben.info ? chart.ben.info.element : '金';
    var yj = liuqinYuanJi(el, useLq);
    if (!yj) return null;
    var roles = compareRoles(chart, { yongshen: useLq, jishen: yj.ji, yuanshen: yj.yuan, choushen: yj.chou });
    return {
      useLq: useLq, yuan: yj.yuan, ji: yj.ji, chou: yj.chou,
      yongshen: roles.yongshen, jishen: roles.jishen, yuanshen: roles.yuanshen, choushen: roles.choushen,
      ysScore: roles.ysScore, jsScore: roles.jsScore, yuanScore: roles.yuanScore, chouScore: roles.chouScore,
      // 有效作用力（已过真空＋爻层次生克权两道闸门）：阵营净力以此为基元，
      // 必须随结果一并透出，否则调用方拿到的仍是未过滤的自身旺衰分，过滤等于白做。
      jsEff: roles.jsEff, yuanEff: roles.yuanEff, chouEff: roles.chouEff,
      // 阵营净力（总判量）与忌神是否得用事，一并以数字/布尔透出
      net: roles.net, jsActive: roles.jsActive,
      bianPangDelta: roles.bianPangDelta, relOrder: roles.relOrder,
      shuangXian: roles.shuangXian, verdict: roles.verdict, shiYingKongPo: roles.shiYingKongPo
    };
  }

  // G 应期候选：按传统规则给方向（候选支＋理据），非保证日期
  function yingqiOf(yao, chart) {
    if (!yao || !chart) return [];
    var wx = yao.wuxing, z = yao.zhi, out = [], seen = {};
    function push(tag, zhi, note) {
      if (seen[tag + (zhi || '')]) return;
      seen[tag + (zhi || '')] = 1;
      out.push({ tag: tag, zhi: zhi || '', note: note });
    }
    push('逢值', z, yao.posName + z + '值日（本爻当令主事）');
    if (LIU_HE[z]) push('逢合', LIU_HE[z], z + '与' + LIU_HE[z] + '六合，逢合则事成或解绊');
    DIZHI.forEach(function (k) {
      if (k !== z && SHENG_MAP[ZHI_WX[k]] === wx) push('逢生', k, ZHI_WX[k] + '生' + wx + '，得生扶之期');
    });
    var marks = ((yao.wang && yao.wang.marks) || []).join('、');
    if (yao.isKong || marks.indexOf('旬空') >= 0) {
      push('冲空', CHONG[z], '旬空待冲，' + CHONG[z] + '日冲空则实');
      push('出旬', '', '过本旬则空亡自解');
    }
    if (yao.isYuePo) {
      push('出月', '', '月破出月方显力');
      if (LIU_HE[z]) push('合破', LIU_HE[z], '月破逢' + LIU_HE[z] + '则破而解');
    }
    if (marks.indexOf('日墓') >= 0 || (yao.hua && yao.hua.flags.indexOf('化墓') >= 0)) {
      if (MU_KU[wx]) push('冲墓', CHONG[MU_KU[wx]], '入' + MU_KU[wx] + '墓待冲开（' + CHONG[MU_KU[wx]] + '日冲开）');
    }
    if (yao.hua && yao.hua.flags.indexOf('化进') >= 0) {
      push('进神', DIZHI[(DIZHI.indexOf(z) + 1) % 12], '化进，进一步之支为期');
    }
    if (yao.hua && yao.hua.flags.indexOf('化退') >= 0) {
      push('退神', DIZHI[(DIZHI.indexOf(z) + 11) % 12], '化退，退一步之支为期（事宜退不宜进）');
    }
    return out;
  }

  // G2 时辰级应期（近事取时）：用神/动爻 值时辰、旬空待冲时辰。
  // 以起卦时辰（chart.hourGanZhi）为基准，给“距起卦第几个时辰后”的候选，
  // 用于应期落在当日或极近时的“此时”判断；远事仍以日/月为主。
  function shiChenYingqi(yao, chart) {
    if (!yao || !chart) return [];
    var hg = chart.hourGanZhi || '';
    var zh0 = hg.charAt(1);
    if (!zh0) return [];
    var z = yao.zhi, out = [], seen = {};
    function push(tag, zhi, note) {
      if (!zhi || seen[tag]) return;
      seen[tag] = 1;
      var i0 = DIZHI.indexOf(zh0), ix = DIZHI.indexOf(zhi);
      if (i0 < 0 || ix < 0) return;
      var delta = (ix - i0 + 12) % 12;
      var when = delta === 0
        ? ('本时辰（' + zh0 + '时，若已过去则明日此时）')
        : ('今日' + zhi + '时（距起卦约 ' + delta + ' 个时辰后）');
      out.push({ tag: tag, zhi: zhi, hours: delta, when: when, note: note });
    }
    push('值时', z, yao.posName + z + '值时（本爻当令之辰，极近之事此时可见分晓）');
    if (yao.isMoving) push('动值', z, '动爻' + z + '时值（发动逢值之辰）');
    if (yao.isKong) push('冲空', CHONG[z], '旬空待冲，' + CHONG[z] + '时冲空则实（极近事取此时）');
    return out;
  }

  // ============ 起卦：三枚铜钱（字为阴2，背为阳3） ============
  // 6=老阴(×) 7=少阳 8=少阴 9=老阳(○)
  // 可注入 rng（默认 Math.random）以便测试可复现；mulberry32 为确定性种子发生器
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function tossCoin(rng) {
    return (rng || Math.random)() < 0.5 ? 2 : 3;
  }
  function tossOnce(rng) {
    var a = tossCoin(rng), b = tossCoin(rng), c = tossCoin(rng);
    var sum = a + b + c;
    return { sum: sum, coins: [a, b, c], back: (a === 3 ? 1 : 0) + (b === 3 ? 1 : 0) + (c === 3 ? 1 : 0) };
  }
  // 摇一卦：返回六个爻自初爻至上爻 [{sum}]；可传 rng 复现
  function tossSix(rng) {
    var res = [];
    for (var i = 0; i < 6; i++) res.push(tossOnce(rng));
    return res;
  }
  function sumToYao(sum) {
    if (sum === 9) return { yang: 1, moving: true, oldYang: true, mark: '○' };
    if (sum === 6) return { yang: 0, moving: true, oldYang: false, mark: '×' };
    if (sum === 7) return { yang: 1, moving: false, mark: '' };
    return { yang: 0, moving: false, mark: '' }; // 8
  }

  // ============ 装卦 ============
  function makeGua(sixYang) {
    // sixYang: 自初至上的阴阳数组
    var lowerBits = [sixYang[0], sixYang[1], sixYang[2]];
    var upperBits = [sixYang[3], sixYang[4], sixYang[5]];
    var lowerIdx = lowerBits[0] + lowerBits[1] * 2 + lowerBits[2] * 4;
    var upperIdx = upperBits[0] + upperBits[1] * 2 + upperBits[2] * 4;
    var lowerKey = IDX2TRI[lowerIdx], upperKey = IDX2TRI[upperIdx];
    var info = GUA64[upperIdx * 8 + lowerIdx];
    return {
      info: info,
      lowerKey: lowerKey, upperKey: upperKey,
      lower: TRIGRAM[lowerKey], upper: TRIGRAM[upperKey],
      six: sixYang.slice(),
      symbol: TRIGRAM[upperKey].symbol + TRIGRAM[lowerKey].symbol,
      name: info ? info.name : '未知'
    };
  }

  // 装六爻（纳甲、六亲、六神、世应）
  function dressGua(gua, opts) {
    opts = opts || {};
    var element = opts.element || (gua.info ? gua.info.element : '土');
    var dayGanZhi = opts.dayGanZhi || '甲子';
    var dayGan = dayGanZhi.charAt(0), dayZhi = dayGanZhi.charAt(1);
    var monthZhi = opts.monthZhi || '寅';
    var xunkong = opts.xunkong || [];
    // 六神起点：终身/年运类以年干起（params.useYearShen 时由 arrange 传 shenGanZhi），否则日干
    var shenGan = (opts.shenGanZhi && opts.shenGanZhi.charAt(0)) || dayGan;
    var shenStart = SHEN_START[shenGan] || 0;

    var lowerNj = NAJIA[gua.lowerKey], upperNj = NAJIA[gua.upperKey];
    var yaos = [];
    for (var i = 0; i < 6; i++) {
      var pos = i + 1; // 1=初爻
      var isInner = i < 3;
      var nj = isInner ? lowerNj : upperNj;
      var zhi = nj.zhi[i];
      var gan = nj.gan || (isInner ? nj.ganIn : nj.ganOut);
      var zhiWx = ZHI_WX[zhi];
      var shiHere = (gua.info && gua.info.shi === pos);
      var yingHere = (gua.info && gua.info.ying === pos);
      yaos.push({
        pos: pos,
        posName: ['初', '二', '三', '四', '五', '上'][i] + '爻',
        yang: gua.six[i],
        gan: gan, zhi: zhi, ganzhi: gan + zhi,
        wuxing: zhiWx,
        liuqin: liuqinOf(element, zhiWx),
        changsheng: changshengStage(zhi, dayGan),
        liushen: SHEN_ORDER[(shenStart + i) % 6],
        isShi: shiHere, isYing: yingHere,
        shiTag: shiHere ? '世' : (yingHere ? '应' : ''),
        isKong: xunkong.indexOf(zhi) >= 0,
        isYuePo: CHONG[monthZhi] === zhi,
        isRiChong: CHONG[dayZhi] === zhi
      });
    }
    return yaos;
  }

  // 旬空
  function calcXunKong(dayGanZhi) {
    var idx = gzIndex2(dayGanZhi.charAt(0), dayGanZhi.charAt(1));
    if (idx < 0) return ['?', '?'];
    var xun = Math.floor(idx / 10); // 0..5
    var a = (10 - 2 * xun + 12) % 12, b = (a + 1) % 12;
    return [DIZHI[a], DIZHI[b]];
  }

  /**
   * 主入口：排盘
   * @param {Object} params {monthGanZhi, dayGanZhi, six:[{sum}], solarText, lunarText, jieqi}
   */
  // ===== 三合／三会成局（典籍条件版）=====
  // 典籍成局条件（多家一致，与 prompts.js 已录规则同）：
  //   参与资格：动爻、暗动爻（日冲旺相之静爻）、日辰、动爻所化之变爻。
  //   **静爻不参与、月建不参与、伏爻不参与、仅两动爻不足以成局**。
  //   成局（三支全且满足其一）：(a) 三爻俱动 (b) 两动＋一暗动 (c) 两动＋日辰 (d) 两动＋一动爻之变爻
  //   破局：局中动爻／变爻被日辰冲散冲脱（暗动本身即日冲旺相，不构成破）；局中动爻化回头克而无解救
  //   半合：只作取象，不给增力（"半合局只用来提取象，不能主宰吉凶"）
  // 旧实现"六爻支＋月日三支齐全即成局"违反上述全部条件，且与文字版（检查破局）自相矛盾：
  //   文字判"不成局"的卦，数字仍 +2 增力——文字与数字打架，比没透出更糟。此处统一为同一套判定。
  var JU_DELTA = { '三合局': 2, '三会方局': 1 };  // 三会只作方局助势，力弱于三合
  function juChengZhi(chart) {
    var mz = chart.monthZhi, dz = chart.dayZhi;
    var yaos = chart.ben.yaos;
    var bian = chart.bian && chart.bian.yaos ? chart.bian.yaos : [];
    var huaZhi = [];
    yaos.forEach(function (y, i) { if (y.isMoving && bian[i]) huaZhi.push(bian[i].zhi); });

    // 该支以何种身份参与合局：'dong' 动爻｜'an' 暗动爻｜'ri' 日辰｜'hua' 动爻之变爻｜null 无资格
    function roleOf(z) {
      var dong = null, an = null;
      for (var i = 0; i < yaos.length; i++) {
        var y = yaos[i];
        if (y.zhi !== z) continue;
        if (y.isMoving) { dong = y; break; }
        var ml = monthLayer(y.zhi, mz);
        var dl = dayLayer(y.zhi, dz, false, ml.state);
        if (dl.flags.indexOf('暗动') >= 0) an = y;
      }
      if (dong) return { r: 'dong', y: dong };
      if (an) return { r: 'an', y: an };
      if (z === dz) return { r: 'ri', y: null };   // 日辰可参与
      if (inArr(huaZhi, z)) return { r: 'hua', y: null };
      return null;                                  // 静爻／月建／伏爻：无资格
    }
    function memberText(z) {
      var o = roleOf(z);
      var lbl = { dong: '动爻', an: '暗动爻', ri: '日辰', hua: '动爻之变爻' };
      if (!o) return z + '(静爻，不参与)';
      if (o.r === 'ri') return z + '(日辰)';
      if (o.r === 'hua') return z + '(变爻)';
      return (o.y ? o.y.posName : '') + z + '(' + lbl[o.r] + ')';
    }
    function chengReason(zhiList) {
      var roles = [];
      for (var i = 0; i < zhiList.length; i++) {
        var o = roleOf(zhiList[i]);
        if (!o) return null;                        // 有一支无资格（静爻／月建）→ 不成局
        roles.push(o.r);
      }
      var nDong = roles.filter(function (r) { return r === 'dong'; }).length;
      var nAn = roles.filter(function (r) { return r === 'an'; }).length;
      var nRi = roles.filter(function (r) { return r === 'ri'; }).length;
      var nHua = roles.filter(function (r) { return r === 'hua'; }).length;
      if (nDong === 3) return '三爻俱动';
      if (nDong === 2 && nAn === 1) return '两动加暗动';
      if (nDong === 2 && nRi === 1) return '两动加日辰';
      if (nDong === 2 && nHua === 1) return '两动加动爻之变爻';
      return null;                                  // 仅两动、或全静 → 不成局
    }
    // 破局：日辰冲散／冲脱局中动爻或变爻；局中动爻化回头克
    function brokenReason(zhiList) {
      var i, o;
      for (i = 0; i < zhiList.length; i++) {
        if (CHONG[dz] !== zhiList[i]) continue;
        o = roleOf(zhiList[i]);
        if (!o) continue;
        if (o.r === 'dong') return '局中动爻' + zhiList[i] + '被日辰' + dz + '冲散';
        if (o.r === 'hua') return '局中变爻' + zhiList[i] + '被日辰' + dz + '冲脱';
      }
      for (i = 0; i < zhiList.length; i++) {
        o = roleOf(zhiList[i]);
        if (o && o.r === 'dong' && o.y && o.y.hua && o.y.hua.flags.indexOf('回头克') >= 0) {
          return '局中动爻' + o.y.posName + zhiList[i] + '化回头克而无解救';
        }
      }
      return null;
    }

    var set = {}, list = [];
    function evalGroup(g, label) {
      var members = g.zhi.map(memberText);
      var present = g.zhi.filter(function (z) { return !!roleOf(z); });
      if (present.length < 3) {
        // 半合：只作取象，不给增力
        if (present.length === 2) {
          var isSheng = pairsMatch(present[0], present[1], BAN_SHENG);
          var isMu = pairsMatch(present[0], present[1], BAN_MU);
          list.push({ type: isSheng ? '生半合' : (isMu ? '墓半合' : '半合'), zhi: g.zhi, wx: g.wx, cheng: false,
            note: (isSheng ? '生半合' : (isMu ? '墓半合（需中神' + g.zhi[1] + '旺）' : '半合'))
              + '：只有两支具参与资格（' + members.join('、') + '）'
              + '——半合局只用来提取象，不能主宰吉凶，故不给增力' });
        }
        return;
      }
      var reason = chengReason(g.zhi);
      if (!reason) {
        list.push({ type: label + '（不成）', zhi: g.zhi, wx: g.wx, cheng: false,
          note: '三支虽具形（' + members.join('、') + '），但动爻不足——典籍明言静爻不参与三合、'
            + '仅两动爻不能成局；只作常规定生克论，不得按局增力' });
        return;
      }
      var br = brokenReason(g.zhi);
      if (br) {
        list.push({ type: label + '（破）', zhi: g.zhi, wx: g.wx, cheng: false,
          note: '具成局之形（' + reason + '：' + members.join('、') + '），但' + br + '，局破；'
            + '不成局则不按局增力，待出空出破或填实之期再论' });
        return;
      }
      var delta = JU_DELTA[label] || 2;
      g.zhi.forEach(function (z) { set[z] = delta; });
      list.push({ type: label, zhi: g.zhi, wx: g.wx, cheng: true, reason: reason,
        note: '成局（' + reason + '：' + members.join('、') + '），以' + g.wx + '局论生克，局内之支增力 +'
          + delta + '；用神入局吉、忌神入局凶，其旺衰须按局重估，不得单看日月' });
    }
    SAN_HE.forEach(function (g) { evalGroup(g, '三合局'); });
    SAN_HUI.forEach(function (g) { evalGroup(g, '三会方局'); });
    return { set: set, list: list };
  }
  function arrange(params) {
    var monthGZ = params.monthGanZhi || '丙寅';
    var dayGZ = params.dayGanZhi || '甲子';
    var yearGZ = params.yearGanZhi || '';
    var hourGZ = params.hourGanZhi || '';
    var monthZhi = monthGZ.charAt(1);
    var xunkong = calcXunKong(dayGZ);
    // 终身/年运：六神以年干起；有出生年则用出生年干（立年命），否则用当年太岁
    var useYearShen = !!params.useYearShen;
    var birthGZ = params.birthYearGanZhi || '';
    var shenGZ = useYearShen ? (birthGZ || yearGZ) : dayGZ;

    var raw = params.six;
    var sixYang = [], moving = [], marks = [];
    for (var i = 0; i < 6; i++) {
      var y = sumToYao(raw[i].sum);
      sixYang.push(y.yang);
      marks.push(y.mark);
      if (y.moving) moving.push({ index: i, pos: i + 1, old: y.oldYang ? '阳' : '阴' });
    }
    var ben = makeGua(sixYang);
    ben.yaos = dressGua(ben, { element: ben.info.element, dayGanZhi: dayGZ, monthZhi: monthZhi, xunkong: xunkong, shenGanZhi: shenGZ });
    ben.yaos.forEach(function (y, i) {
      y.isMoving = !!marks[i];
      y.mark = marks[i];
      y.old = moving.filter(function (m) { return m.index === i; }).map(function (m) { return m.old; })[0] || '';
    });
    ben.fu = getFuShen(ben.info);

    var bian = null;
    if (moving.length > 0) {
      var bianSix = sixYang.slice();
      moving.forEach(function (m) { bianSix[m.index] = bianSix[m.index] ? 0 : 1; });
      bian = makeGua(bianSix);
      bian.yaos = dressGua(bian, { element: ben.info.element, dayGanZhi: dayGZ, monthZhi: monthZhi, xunkong: xunkong, shenGanZhi: shenGZ });
      // 标注变爻
      bian.yaos.forEach(function (y, i) {
        var mv = false;
        moving.forEach(function (m) { if (m.index === i) mv = true; });
        y.isChanged = mv;
      });
      // 世应只属于本卦：变卦仅作化出参照，不另标世应（否则前端会出现两个应爻）
      bian.yaos.forEach(function (y) { y.isShi = false; y.isYing = false; y.shiTag = ''; });
    }

    var chart = {
      solarText: params.solarText || '',
      lunarText: params.lunarText || '',
      jieqi: params.jieqi || '',
      monthGanZhi: monthGZ,
      dayGanZhi: dayGZ,
      yearGanZhi: yearGZ,
      hourGanZhi: hourGZ,
      monthZhi: monthZhi,
      dayZhi: dayGZ.charAt(1),
      xunkong: xunkong,
      yuepo: CHONG[monthZhi],
      six: raw,
      moving: moving,
      ben: ben,
      bian: bian,
      movingCount: moving.length,
      useYearShen: useYearShen,
      birthYearGanZhi: birthGZ,
      shenGanZhi: shenGZ
    };

    // 日月救应（架构层：月建为纲，日辰执行救应）→ 逐爻综合力量（条件判断→属性赋值→力量加减）
    chart.riyue = riyueResolve(chart);
    // 年命层（终身运专属）：生年纳音为命基，与世爻比生克墓空破
    chart.yearMing = yearMingLayer(chart);
    // 先定化爻（成局判定要查"局中动爻化回头克"），再定局，最后才逐爻综合力量
    chart.ben.yaos.forEach(function (y, i) {
      // 爻号 1-6（初=1…上=6）：力量层面一律以爻号指称，六亲只作取象的代称
      y.idx = i + 1;
      if (chart.bian && chart.bian.yaos[i] && y.isMoving) y.hua = huaLayer(y, chart.bian.yaos[i]);
    });
    // 三合/三会成局（典籍条件版）：先于旺衰汇总前算好入局地支与增力值，使 yaoStrength 能按局增力
    // （"先有三合六合、再论旺衰"）。文字版与数字版同出此一处，杜绝二者打架。
    var ju = juChengZhi(chart);
    chart._juZhi = ju.set;
    chart._juList = ju.list;
    chart.ben.yaos.forEach(function (y) {
      y.strength = yaoStrength(y, chart);
      y.wang = y.strength;
    });
    if (chart.bian) {
      chart.bian.yaos.forEach(function (y) {
        y.strength = yaoStrength(y, chart);
        y.wang = y.strength;
      });
    }
    // 变爻旁爻层：变爻对本位动爻无生克合冲时，转去作用主卦其它旁爻（第二层次的定向）
    chart._bianPang = bianPangLayer(chart);
    // 变爻旁爻叠加：直接改写目标爻的力量分数（下沉原则），须在全部爻基础分算完之后执行
    chart._bianPangApplied = bianPangApply(chart);
    // 快照：旁爻之后、爻际之前。爻际量化依赖用神（忌神不得用事只针对用神），而用神在装卦
    // 之后才由问句解析，故量化必须推迟到用神确定之时，且须能反复重算（消融实验切换开关后重跑）。
    chart.ben.yaos.forEach(function (y) {
      if (!y.wang) return;
      y._preInterScore = y.wang.score;
      y._preInterMarks = y.wang.marks.slice();
    });
    // 装卦时已给定用神则顺手下沉；未给定（生产路径：用神由问句后解析）则由上层调用 applyInterYao
    applyInterYao(chart, params.useLq);
    // 用神生克图（可选）：传入 useLq 时由引擎直接算用神/原神/忌神与力量对比，供提示词层引用（单一来源）
    if (params.useLq) chart.roles = getUseGodRelation(chart, params.useLq);
    return chart;
  }

  // ==================== 合 / 冲 / 刑 / 害 / 破 / 墓 / 空 ====================
  // 六合（子丑、寅亥、卯戌、辰酉、巳申、午未）及其合化之五行
  var HE_PAIRS = [
    { zhi: ['子', '丑'], hua: '土' }, { zhi: ['寅', '亥'], hua: '木' },
    { zhi: ['卯', '戌'], hua: '火' }, { zhi: ['辰', '酉'], hua: '金' },
    { zhi: ['巳', '申'], hua: '水' }, { zhi: ['午', '未'], hua: '土' }
  ];
  var LIU_HE = {};
  HE_PAIRS.forEach(function (p) { LIU_HE[p.zhi[0]] = p.zhi[1]; LIU_HE[p.zhi[1]] = p.zhi[0]; });
  function heOf(a, b) {
    for (var i = 0; i < HE_PAIRS.length; i++) {
      var z = HE_PAIRS[i].zhi;
      if ((z[0] === a && z[1] === b) || (z[0] === b && z[1] === a)) return HE_PAIRS[i];
    }
    return null;
  }
  // 三合局 / 三会方局
  var SAN_HE = [
    { zhi: ['申', '子', '辰'], wx: '水' }, { zhi: ['亥', '卯', '未'], wx: '木' },
    { zhi: ['寅', '午', '戌'], wx: '火' }, { zhi: ['巳', '酉', '丑'], wx: '金' }
  ];
  var SAN_HUI = [
    { zhi: ['寅', '卯', '辰'], wx: '木' }, { zhi: ['巳', '午', '未'], wx: '火' },
    { zhi: ['申', '酉', '戌'], wx: '金' }, { zhi: ['亥', '子', '丑'], wx: '水' }
  ];
  // 半合：生半合（力量较大）/ 墓半合（需中神旺）
  var BAN_SHENG = [['申', '子'], ['亥', '卯'], ['寅', '午'], ['巳', '酉']];
  var BAN_MU = [['子', '辰'], ['卯', '未'], ['午', '戌'], ['酉', '丑']];
  // 暗合 / 拱合（虚拱力弱）
  var AN_HE = [['寅', '丑'], ['卯', '申'], ['午', '亥']];
  var GONG_HE = [['寅', '辰', '卯'], ['申', '戌', '酉'], ['亥', '丑', '子'], ['巳', '未', '午']];
  // 刑：三刑组 + 自刑
  var XING = [
    { zhi: ['子', '卯'], name: '无礼之刑' },
    { zhi: ['寅', '巳', '申'], name: '无恩之刑' },
    { zhi: ['丑', '戌', '未'], name: '恃势之刑' }
  ];
  var ZI_XING = ['辰', '午', '酉', '亥'];
  // 六害（六穿）/ 相破
  var HAI = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
  var PO = { 子: '酉', 酉: '子', 丑: '辰', 辰: '丑', 寅: '亥', 亥: '寅', 卯: '午', 午: '卯', 巳: '申', 申: '巳', 未: '戌', 戌: '未' };
  // 墓库：木墓未、火墓戌、金墓丑、水土墓辰
  var MU_KU = { 水: '辰', 土: '辰', 木: '未', 火: '戌', 金: '丑' };

  /* ── 野鹤《随鬼入墓章》「三墓」显式化 ──────────────────────────────
   * 原书立「日墓／动墓／化墓」三墓：
   *   日墓＝日辰正临该五行之墓库（值日辰被困）→ 例如辰日，水土之爻皆入日墓
   *   动墓＝动爻本身地支即为自身五行的墓库
   *   化墓＝动爻所化之变爻落入墓库
   * 引擎此前把日墓/化墓算进 wang.marks 与 hua.flags（分值已生效），
   * 但未把「动墓」「世爻墓于何辰」作为可查询字段透出 ——
   * 按项目铁律「引擎算了但没透出字段＝没算」，此处补为显式 API。
   * 注意：本套「墓库」与纳甲长生十二宫的「墓」是两套不同机制，不可混用：
   *   长生十二宫＝永续状态（MU_KU 不参与）；墓库＝临时被困（可冲开）。
   */
  function muZhiOf(wuxing) { return MU_KU[wuxing] || ''; }
  function isRiMu(wuxing, dayZhi) { return !!dayZhi && MU_KU[wuxing] === dayZhi; }
  function isDongMu(zhi, wuxing) { return MU_KU[wuxing] === zhi; }        // 动墓：动爻地支即自身墓库
  function muFlagsOf(chart) {
    // 逐爻输出三墓，供取象与对照使用（不改旺衰分值，分值仍由 wang/hua 原有逻辑给）
    var dz = chart && chart.dayZhi, mz = chart && chart.monthZhi;
    return chart.ben.yaos.map(function (y) {
      var by = null;
      if (y.isMoving && chart.bian) {
        by = chart.bian.yaos.filter(function (o) { return o.pos === y.pos; })[0] || null;
      }
      return {
        pos: y.pos, posName: y.posName, ganzhi: y.ganzhi, liuqin: y.liuqin, wuxing: y.wuxing,
        muZhi: MU_KU[y.wuxing] || '',
        riMu: isRiMu(y.wuxing, dz),                 // 日墓
        yueMu: isRiMu(y.wuxing, mz),                // 月墓（原书亦论）
        dongMu: y.isMoving && isDongMu(y.zhi, y.wuxing),   // 动墓
        huaMu: !!(by && isDongMu(by.zhi, by.wuxing)),       // 化墓
        huaGanzhi: by ? by.ganzhi : '',
        note: [
          isRiMu(y.wuxing, dz) ? '日墓（' + dz + '）' : '',
          isRiMu(y.wuxing, mz) ? '月墓（' + mz + '）' : '',
          (y.isMoving && isDongMu(y.zhi, y.wuxing)) ? '动墓' : '',
          (by && isDongMu(by.zhi, by.wuxing)) ? '化墓（化' + by.ganzhi + '）' : ''
        ].filter(Boolean).join('·')
      };
    });
  }
  // 神煞（以日支 / 日干取）
  var YI_MA = { 寅: '申', 午: '申', 戌: '申', 申: '寅', 子: '寅', 辰: '寅', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
  var TAO_HUA = { 申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 巳: '午', 酉: '午', 丑: '午', 亥: '子', 卯: '子', 未: '子' };
  var GUI_REN = { 甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'], 壬: ['卯', '巳'], 癸: ['卯', '巳'], 辛: ['寅', '午'] };
  var YANG_REN = { 甲: '卯', 乙: '寅', 丙: '午', 丁: '巳', 戊: '午', 己: '巳', 庚: '酉', 辛: '申', 壬: '子', 癸: '亥' };

  function inArr(arr, v) { return arr.indexOf(v) >= 0; }
  function pairsMatch(a, b, list) {
    for (var i = 0; i < list.length; i++) {
      if ((list[i][0] === a && list[i][1] === b) || (list[i][0] === b && list[i][1] === a)) return true;
    }
    return false;
  }

  /**
   * 合、冲、刑、害、破、墓、空、局会、伏吟反吟、飞伏、神煞 的综合分析
   */
  function analyzeRelations(chart) {
    var mz = chart.monthZhi, dz = chart.dayZhi;
    var dGan = chart.dayGanZhi.charAt(0);
    var yaos = chart.ben.yaos;
    var res = { yao: [], ju: [], anhe: [], gonghe: [], guaBian: '', fuFan: [], feiFu: [], shensha: {} };

    // 地支池：六爻支 + 月建 + 日辰
    var pool = yaos.map(function (y) { return y.zhi; }).concat([mz, dz]);

    // 局支载体：判断某支是否"空破失载"（该支在卦内所附之爻皆旬空休囚或月破，且无月日填实）
    function juBroken(z) {
      if (z === mz || z === dz) return false; // 月日填实，不破
      var ys = yaos.filter(function (y) { return y.zhi === z; });
      if (!ys.length) return false;
      return ys.every(function (y) { return y.isYuePo || (y.isKong && y.wang && y.wang.score <= -1); });
    }
    function juMembers(g) {
      return g.zhi.map(function (z) {
        var ys = yaos.filter(function (y) { return y.zhi === z; });
        if (ys.length) return ys[0].posName + z + (ys[0].isMoving ? '(动)' : '');
        if (z === mz) return z + '(月建)';
        if (z === dz) return z + '(日辰)';
        return z;
      });
    }

    // 三合／三会：直接采用装卦阶段已算好的成局判定（chart._juList），
    // 文字与数字同出一源——旧版此处另算一套（只查旬空月破、不查动爻），与数字版增力互相打架。
    var juSrc = chart._juList || juChengZhi(chart).list;
    juSrc.forEach(function (j) {
      res.ju.push({ type: j.type, zhi: j.zhi.join(''), wx: j.wx, note: j.note });
    });
    AN_HE.forEach(function (p) {
      if (inArr(pool, p[0]) && inArr(pool, p[1])) res.anhe.push({ zhi: p.join(''), note: '暗合，主暗中勾连、隐蔽之事' });
    });
    GONG_HE.forEach(function (g) {
      if (inArr(pool, g[0]) && inArr(pool, g[1])) res.gonghe.push({ zhi: g[0] + g[1], note: '拱合（拱出' + g[2] + '），虚拱力弱' });
    });

    res.shensha = {
      yiMa: YI_MA[dz] || '', taoHua: TAO_HUA[dz] || '',
      guiRen: GUI_REN[dGan] || [], yangRen: YANG_REN[dGan] || ''
    };

    yaos.forEach(function (y, i) {
      var tags = [];
      var strong = y.wang.score >= 1, weak = y.wang.score <= -1;

      if (LIU_HE[dz] === y.zhi) {
        tags.push('与日辰' + dz + '六合' + (strong ? '（旺相被合＝合起，能成事、主合作）' : (weak ? '（休囚被合＝合绊，被绊住、拖延）' : '')));
      }
      if (CHONG[dz] === y.zhi) {
        var cn = strong ? '（旺相被冲＝冲起，反而动起来可用）' : (weak ? '（休囚被冲＝冲散，散败不成）' : '');
        if (!y.isMoving && strong) cn += '（静爻旺相被日冲＝暗动）';
        if (!y.isMoving && weak) cn += '（静爻休囚被日冲＝日破）';
        tags.push('日辰' + dz + '相冲' + cn);
        if (y.isKong) tags.push('冲空（旬空逢日冲，冲空则实）');
      }
      if (HAI[dz] === y.zhi) tags.push('与日辰' + dz + '相害（暗损、不和、小人）');
      if (PO[dz] === y.zhi) tags.push('与日辰' + dz + '相破（破坏损耗，力弱）');
      if (MU_KU[y.wuxing] === dz) tags.push('入墓于日辰' + dz + '（被困、收藏，待冲开方有用）');

      if (LIU_HE[mz] === y.zhi) tags.push('与月建' + mz + '六合' + (strong ? '（合起）' : '（合绊）'));
      if (CHONG[mz] === y.zhi) tags.push('月建' + mz + '相冲（月破）');
      if (MU_KU[y.wuxing] === mz) tags.push('入墓于月建' + mz);

      yaos.forEach(function (o, j) {
        if (i === j) return;
        if (LIU_HE[o.zhi] === y.zhi && i < j) {
          var hp = heOf(y.zhi, o.zhi);
          var hn = hp ? '，可合化' + hp.hua + '（须月令生助方论化，否则只论合不论化）' : '';
          tags.push('与' + o.posName + o.zhi + '六合' + hn + (strong ? '（合起）' : (weak ? '（合绊）' : '')));
        }
        if (CHONG[o.zhi] === y.zhi && i < j) {
          tags.push('与' + o.posName + o.zhi + '六冲' + (strong ? '（冲起）' : (weak ? '（冲散）' : '')));
        }
      });

      if (inArr(ZI_XING, y.zhi)) {
        var zx = yaos.filter(function (o) { return o.zhi === y.zhi; }).length;
        tags.push(zx >= 2 ? (y.zhi + '自刑成（' + y.zhi + '见' + y.zhi + '，自寻烦恼、自伤）')
                          : (y.zhi + '带自刑之性（单见不成刑，仅作倾向参考）'));
      }
      if (y.isKong) tags.push('旬空' + (strong ? '（旺相之空，待出空填实可用）' : '（休囚之空，到底无用）'));

      res.yao.push({ pos: y.pos, posName: y.posName, tags: tags });
    });

    function chongGua(six) {
      return six.length === 6 && CHONG[six[0]] === six[3] && CHONG[six[1]] === six[4] && CHONG[six[2]] === six[5];
    }
    function heGua(six) {
      return six.length === 6 && LIU_HE[six[0]] === six[3] && LIU_HE[six[1]] === six[4] && LIU_HE[six[2]] === six[5];
    }
    var bz = yaos.map(function (y) { return y.zhi; });
    var benChong = chongGua(bz), benHe = heGua(bz);
    if (chart.bian) {
      var vz = chart.bian.yaos.map(function (y) { return y.zhi; });
      var bianChong = chongGua(vz), bianHe = heGua(vz);
      if (benChong && bianHe) res.guaBian = '本卦六冲、变卦六合：先散后成，先难后易（吉）';
      else if (benHe && bianChong) res.guaBian = '本卦六合、变卦六冲：先成后散，先易后难（凶）';
      else if (benChong && bianChong) res.guaBian = '六冲变六冲：冲之又冲，事多反复急切';
      else if (benHe && bianHe) res.guaBian = '六合变六合：合之又合，事多缠绵难解';
      else res.guaBian = benChong ? '本卦六冲：主散、急、初期阻滞' : (benHe ? '本卦六合：主合、缓、事有牵缠' : '本卦无六冲六合之变');
      var allSame = bz.every(function (z, k) { return z === vz[k]; });
      var allChong = bz.every(function (z, k) { return CHONG[z] === vz[k]; });
      if (allSame) res.fuFan.push('卦之伏吟：主停滞、呻吟、进展迟缓');
      if (allChong) res.fuFan.push('卦之反吟：主反复、颠倒、事有来回');
    } else {
      res.guaBian = benChong ? '本卦六冲：主散、急、初期阻滞' : (benHe ? '本卦六合：主合、缓、事有牵缠' : '本卦无六冲六合之变');
    }

    // 飞伏：伏神伏于飞神（本卦同位爻）之下
    if (chart.ben.fu && chart.ben.fu.length) {
      chart.ben.fu.forEach(function (f, i) {
        var fei = yaos[i];
        if (!fei) return;
        var r = [];
        var rel = (fei.wuxing === f.wuxing) ? '比和'
          : (SHENG_MAP[fei.wuxing] === f.wuxing ? '飞生伏（伏神得生，可出）'
            : (SHENG_MAP[f.wuxing] === fei.wuxing ? '伏生飞（伏神泄气）'
              : (KE_MAP[fei.wuxing] === f.wuxing ? '飞克伏（伏神受制，难出）'
                : (KE_MAP[f.wuxing] === fei.wuxing ? '伏克飞（伏神可出）' : ''))));
        if (rel) r.push(rel);
        if (LIU_HE[fei.zhi] === f.zhi) r.push('飞伏相合');
        if (CHONG[fei.zhi] === f.zhi) r.push('飞伏相冲（冲开则伏神可出）');
        if (r.length) res.feiFu.push({ pos: f.pos, fu: f.ganzhi + f.liuqin, fei: fei.ganzhi + fei.liuqin, rel: r.join('，') });
      });
    }

    return res;
  }

  return {
    HE_PAIRS: HE_PAIRS, LIU_HE: LIU_HE, SAN_HE: SAN_HE, SAN_HUI: SAN_HUI,
    HAI: HAI, PO: PO, MU_KU: MU_KU, ZI_XING: ZI_XING, XING: XING,
    // 野鹤「三墓」显式查询（日墓／月墓／动墓／化墓）；与纳甲长生十二宫的「墓」是两套机制
    muZhiOf: muZhiOf, isRiMu: isRiMu, isDongMu: isDongMu, muFlagsOf: muFlagsOf,
    analyzeRelations: analyzeRelations,
    TIANGAN: TIANGAN, DIZHI: DIZHI, TRIGRAM: TRIGRAM, NAJIA: NAJIA,
    GUA64: GUA64, ZHI_WX: ZHI_WX, GAN_WX: GAN_WX, CHONG: CHONG,
    SHEN_ORDER: SHEN_ORDER, CHANGSHENG_ORDER: CHANGSHENG_ORDER, CHANGSHENG_START: CHANGSHENG_START,
    liuqinOf: liuqinOf, wangShuai: wangShuai, changshengStage: changshengStage,
    tossSix: tossSix, tossOnce: tossOnce, arrange: arrange,
    calcXunKong: calcXunKong, makeGua: makeGua, getFuShen: getFuShen,
    monthLayer: monthLayer, dayLayer: dayLayer, kongResolve: kongResolve,
    riyueResolve: riyueResolve, huaLayer: huaLayer, yaoStrength: yaoStrength,
    compareRoles: compareRoles, getUseGodRelation: getUseGodRelation, yingqiOf: yingqiOf, shiChenYingqi: shiChenYingqi, csZhiOf: csZhiOf, csStageOfZhi: csStageOfZhi,
    setAblation: setAblation, ABLATION: ABLATION,
    // 爻的四个层次与爻际作用（曲炜《六爻详真》）：层次即生克权，与旺衰（力量）为两个维度
    LAYER: LAYER, LAYER_NAME: LAYER_NAME, layerOf: layerOf, hasPower: hasPower,
    relBetween: relBetween, effForce: effForce, bianPangLayer: bianPangLayer,
    // 爻际量化的对外入口（幂等，用神确定后调用；消融实验切换开关后重跑即得新数字）
    applyInterYao: applyInterYao, relWeight: relWeight, juChengZhi: juChengZhi,
    nayinOf: nayinOf, yearMingLayer: yearMingLayer,
    liuqinOf: liuqinOf, liuqinRelations: liuqinRelations,
    // 六亲五行随卦宫推导（非写死）：以下为逐卦实算 API
    lqWuxing: lqWuxing, liuqinYuanJi: liuqinYuanJi, wuxingNote: wuxingNote,
    assertYuanJiAll: assertYuanJiAll, _YJ_ERRORS: _YJ_ERRORS,
    deriveYuanJi: deriveYuanJi, // 兼容旧签名：deriveYuanJi(element, lq)
    WUXING_NOTE: WUXING_NOTE,    // 注意：此为函数 wuxingNote，按 chart 动态取，勿当静态字符串
    YUE_SCORE: YUE_SCORE, RI_SCORE: RI_SCORE, HUA_SCORE: HUA_SCORE
  };
});
