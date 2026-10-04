/**
 * 六爻生活占卜 —— 模块配置 / 语义映射 / 离线解析引擎 / 智能体请求构造
 */
(function (root, factory) {
  var api = factory(
    typeof require === 'function' ? require('./prompts.js') : root.AgentPrompts,
    typeof require === 'function' ? require('./symbol_dict.js') : root.SymbolDict
  );
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; } else { root.AppConfig = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (P, SYM) {

  var G = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : this);
  var LY = (typeof require === 'function') ? require('./liuyao.js') : G.LiuYao;
  var DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var WX_SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  var WX_KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

  // ==================== 八卦象意（分模块） ====================
  var TRIGRAM_SEMANTIC = {
    diet: {
      qian: { core: '天行健，清阳上升', like: '露天果实、菌菇、坚果仁、清淡高蛋白', advice: '取其“清补”，宜少量慢食，配温水', risk: '空腹食之易伤胃气' },
      kun: { core: '厚德载物，万物致养', like: '根茎薯类、五谷主食、甘味食材', advice: '脾胃之主，作基底主食最稳', risk: '过量则滞，生湿困脾' },
      zhen: { core: '雷出地奋，疏泄生发', like: '嫩芽时蔬、酸味发酵、青绿菜蔬', advice: '春季或肝气不舒时最宜，助疏泄', risk: '胃酸过多者少取' },
      xun: { core: '随风巽入，轻盈渗透', like: '粥羹汤水、清炖、易消化的流质', advice: '肠胃虚弱时的过渡餐', risk: '久食缺少咀嚼，脾胃运化渐弱' },
      kan: { core: '水润下，藏精纳咸', like: '海产、汤汤水水、咸鲜调味', advice: '秋冬温食，佐姜以制其寒', risk: '生冷海鲜伤阳，夜食易水肿' },
      li: { core: '火性炎上，明丽附物', like: '烧烤煎炸、爆炒锅气、苦味焦香', advice: '偶尔取之，配凉性蔬菜平衡', risk: '燥热伤津，长口疮、便秘' },
      gen: { core: '艮为止，坚确难化', like: '坚果硬壳、耐嚼肉干、粘糯糕点', advice: '咀嚼充分，限量一小把', risk: '停滞难消，积食生热' },
      dui: { core: '兑为口舌，悦而燥', like: '辛辣刺激、瓜子炒货、干燥零食', advice: '佐汤水润之，浅尝即止', risk: '辛辣燥肺，咽干上火' }
    },
    sport: {
      qian: { core: '天行健，开阔高远', place: '开阔户外、高层平台、视野通透处', advice: '适合拉长呼吸、慢 positives 的长距离项目', risk: '大风降温天需护颈' },
      kun: { core: '地势坤，平稳承载', place: '瑜伽馆、塑胶场地、平稳地面', advice: '打基础、练姿态、恢复期的首选', risk: '过于求稳则强度不足' },
      zhen: { core: '雷动，突发伸展', place: '动态街区、跑道、操场', advice: '爆发性训练、间歇跑、冲刺', risk: '膝踝冲击大，必须热身' },
      xun: { core: '风入微，柔韧流长', place: '通风长廊、河堤绿道、无障碍通路', advice: '拉伸、慢跑、呼吸配合的连续运动', risk: '人少时注意安全' },
      kan: { core: '水润下行，全身环流', place: '泳池、水域、湿度大的场馆', advice: '最省关节的全身有氧，适合康复', risk: '水温过低易抽筋' },
      li: { core: '火性炎上，高温明烈', place: '日照充足处、高温房、拳馆', advice: '燃脂效率高，控制时长', risk: '脱水与中暑，及时补液' },
      gen: { core: '艮为山，静止负重', place: '山体、岩壁、静力训练区', advice: '攀爬、平板支撑、慢力量，练耐力', risk: '憋气过久，注意呼吸节奏' },
      dui: { core: '兑为悦，社交竞技', place: '球场、团队场地、热闹的运动馆', advice: '球类、双人对练，愉悦感强易坚持', risk: '胜负心重容易过量' }
    },
    fun: {
      qian: { core: '天象高远，视野开阔', act: '登高望远、看展、观星、城市漫游', vibe: '明朗、有格局感的愉悦', advice: '适合需要“换个角度看事情”的时候' },
      kun: { core: '地势厚实，安居生养', act: '居家手作、烘焙、整理房间、慢综艺', vibe: '踏实、落地、被生活托住', advice: '适合安全感不足、需要“收”的时候' },
      zhen: { core: '雷动奋起，刺激破除', act: '密室逃脱、演唱会、蹦床、K歌', vibe: '兴奋、释放、有爆发感', advice: '太沉闷时用它破局，但不宜连续' },
      xun: { core: '风行多处，流动轻盈', act: '散步、逛店、轻旅行、骑行', vibe: '松弛、随缘、舒展', advice: '不想被打扰又不想空耗时的最佳选择' },
      kan: { core: '水深藏幽，内观独处', act: '温泉泡澡、电影、深夜独坐、冥想', vibe: '沉静、私密、向内收', advice: '信息过载时的修复手段' },
      li: { core: '火色明丽，热闹联结', act: '拍照打卡、灯光展、聚餐烧烤、市集', vibe: '明亮、社交、被看见', advice: '想热闹、想被回应时优先' },
      gen: { core: '艮止沉定，专注自持', act: '垂钓、拼图、书写、长时间阅读', vibe: '专注、安定、慢下来', advice: '心浮气躁时用它“止”一会儿' },
      dui: { core: '兑言悦口，交流分享', act: '朋友聚会、桌游、闲聊、双向分享', vibe: '轻松、联结、有回响', advice: '孤独感强时用，避免独自闷着' }
    }
  };

  // ============ 六神取象（分模块）—— 检索层① ============
  // 结构：模块 → 六神 → { 象意 xiang / 宜 yi / 忌 ji }
  var SHEN_SEMANTIC = {
    diet: {
      青龙: { xiang: '食欲活跃、代谢偏旺，吃进去转化效率高', yi: '趁鲜尝新，时令为先', ji: '忌过酸过生，肝气过旺' },
      朱雀: { xiang: '心火偏旺、进食偏急，容易边说边吃', yi: '先静后食，细嚼慢咽', ji: '忌边谈边吞、忌烫食' },
      勾陈: { xiang: '脾胃迟缓、运化偏慢，身体发沉', yi: '温软少量，慢炖蒸煮', ji: '忌生冷黏腻、忌过饱' },
      螣蛇: { xiang: '肠胃敏感、易纠结反复，耐受度低', yi: '单一清淡，少混杂', ji: '忌生冷杂乱混食、忌尝鲜过多' },
      白虎: { xiang: '消耗偏大、有损伤倾向，辛辣易激', yi: '清润平补，护黏膜', ji: '忌辛辣刺激、忌酒与过量' },
      玄武: { xiang: '阴寒内伏、代谢偏低，阳气不足', yi: '温热熟食，佐姜暖中', ji: '忌生冷寒凉、忌夜食' }
    },
    sport: {
      青龙: { xiang: '振奋型，心率提升快、状态上扬', yi: '趁势练到位，可适度加量', ji: '忌热身不足直接冲' },
      朱雀: { xiang: '表达型，偏好有节奏、有呼应的项目', yi: '操课、舞蹈、球类', ji: '忌枯燥重复致半途而废' },
      勾陈: { xiang: '滞重型，身体发沉、启动慢', yi: '先动起来再谈强度，重热身', ji: '忌一上来就上高强度' },
      螣蛇: { xiang: '纠结型，注意力难集中、动作易变形', yi: '单一重复、低复杂度', ji: '忌复杂器械与冲量' },
      白虎: { xiang: '锐利型，爆发力强但易过头', yi: '控制组数与力竭度', ji: '忌冲极限、忌带伤硬撑' },
      玄武: { xiang: '舒缓型，适合慢练与水中活动', yi: '拉伸、游泳、慢走', ji: '忌憋气发力、忌竞技' }
    },
    fun: {
      青龙: { xiang: '创造愉悦态，需要新鲜、美感、值得庆祝', yi: '看展、尝新、拍照打卡', ji: '忌重复单调' },
      朱雀: { xiang: '表达交流态，需要说话、表演、被听见', yi: 'K歌、聚会、分享', ji: '忌独自闷着' },
      勾陈: { xiang: '踏实停留态，需要手工、居家、稳定陪伴', yi: '手作、烘焙、整理', ji: '忌行程安排过满' },
      螣蛇: { xiang: '灵动变换态，需要流动、多变、轻量切换', yi: '散步、逛店、轻旅行', ji: '忌久坐闷室' },
      白虎: { xiang: '竞技挑战态，需要解谜、对抗、突破感', yi: '密室、桌游、攀岩', ji: '忌涉险、忌涉赌' },
      玄武: { xiang: '探索未知态，需要独处、神秘感、向内探寻', yi: '电影、冥想、深夜独处', ji: '忌喧闹人群' }
    }
  };

  // ============ 六亲传统类象（典籍通义，不分模块）—— 检索层②-根 ============
  // 这是六爻本身的固有知识（《增删卜易》《卜筮正宗》类象体系），不是举例，也不随模块变。
  // 模块取象必须由这一层派生：先明传统类象，再落到该提问类型的具体事物。
  var LIUQIN_CLASSIC = {
    父母: '生我者。传统类象：父母长辈师长祖先、文书契约证书印章、学问理论文章、师承与古法传统、规矩制度、教育、房屋宅舍、学校衙门庙宇、车船衣物被褥雨具、纸张书籍布匹、雨云雾霜；于身主头面胸背皮肤；于事主庇护、承载、辛劳。',
    官鬼: '克我者。传统类象：官长上司、官职功名、官司诉讼、疾病灾祸、损伤、压力耗损、管束、鬼神怪异、雷电雾、盗贼小人、敌人；于身主病处痛处；于事主克我、阻碍与忧患。',
    妻财: '我克者。传统类象：妻妾女友、仆从、钱财货物、粮食食物、器皿家具、金银珠玉、财产工资利润、可耗用之物；于身主血液津液与饮食所入；于事主可支配、可享用者。',
    子孙: '我生者，古称"喜神""福神"。传统类象：子孙晚辈弟子、医生僧道艺人、医药、消遣娱乐欢愉、技艺表达、福气解忧、生财之源、药物玩具乐器、晴天日月星、禽鸟；于身主眼耳鼻口与呼吸；于事主舒畅、产出。其于五行恒能克制官鬼（五卦宫皆然），故有喜神之名，主解忧散灾、消解阻滞、化解之门；此名号只言其固有功能，不代表本次占断中即为吉神，吉凶仍以用神生克图为准。',
    兄弟: '同我者。传统类象：兄弟朋友同事同伴、竞争对手、同辈、口舌是非、分财破财耗财、阻碍、情谊互助；于身主四肢手足肩；于事主分夺、竞争与相伴。'
  };

  // ============ 六亲取象（分模块）—— 检索层②-用 ============
  // 上层 role 是六亲的通用抽象义（生克关系决定，不随模块变）；
  // 下层 xiang 是"该提问类型下这个六亲指什么事物"，随模块变（如妻财：饮食=食物，运动=器材装备）。
  // 六亲在"问事类"占断中的通用取象（中间检索层：模块未专设时用它，避免直落传统类象过泛）
  var LIUQIN_QA = {
    妻财: { role: '我克者，主可支配、可耗用之人财物', xiang: '所问之钱财货物、可动用的资源；男占感情时为对方；失物占时为所失之物', yi: '取其旺相得地、生合世爻者', ji: '忌空破休囚、忌兄弟发动劫夺' },
    官鬼: { role: '克我者，主压力、阻碍、官府、病症', xiang: '所问之事的阻碍方：官府判决、职位权柄、病症、压力耗损；女占感情时为对方', yi: '问利则宜其衰、问官职则宜其旺', ji: '忌旺动克世、忌持世而克世' },
    父母: { role: '生我者，主文书、音信、宅舍、长辈、规矩', xiang: '契约文书、录取通知、成绩榜文、音信消息、房宅田产、长辈庇护、行李车辆', yi: '取其旺相不空，文书音信方有着落', ji: '忌空破则文书无凭、忌动而克世主劳苦' },
    子孙: { role: '我生者，古称喜神、福神，主医药、化解之门、财源、子女（名号指其固有功能，非谓本次即吉，吉凶仍回用神）', xiang: '医药与痊愈之力、消解忧患的解药、财源活水、子女晚辈、技艺表达', yi: '取其旺相得地，可制官鬼、解忧散灾', ji: '忌空破则药不对症、忌休囚则化解无力' },
    兄弟: { role: '同我者，主同辈同伴、竞争者、分夺破耗', xiang: '竞争对手、同辈伙伴、分财破耗之事、牵绊阻隔；年运与通用占中兼作自身气数', yi: '问财宜其衰、问助力宜其旺', ji: '忌发动劫财、忌旺而克世' }
  };

  var LIUQIN_SEMANTIC = {
    diet: {
      妻财: { role: '我克者为妻财，主可支配、可摄入之物', xiang: '食物、食材、餐食、饮品，即"这一顿具体吃什么"', yi: '取当季当地、烹饪得当者', ji: '忌不洁、过期、与当下体质相冲之物' },
      子孙: { role: '我生者为子孙，主运化、舒畅与产出', xiang: '消化吸收能力、进食后的舒畅感、肠道运化', yi: '可稍加营养密度', ji: '忌暴饮暴食压垮运化' },
      官鬼: { role: '克我者为官鬼，主耗损、压力、伤病', xiang: '伤食、忌口之物、病气、酒精药物，以及身体已有的不适', yi: '回避，症状明显须咨询专业人士', ji: '忌硬扛、忌以酒药压症状' },
      父母: { role: '生我者为父母，主承载、庇护、传统方式与理论', xiang: '家常做法、传统食疗理论、食谱规矩、厨房与餐具、长辈传下的吃法', yi: '照经典做法，取其稳妥', ji: '忌拘泥旧说不辨自身体质' },
      兄弟: { role: '同我者为兄弟，主同辈、分夺、竞争', xiang: '分食共享、请客花费、抢食，以及分量上的过量', yi: '分享，量入为出', ji: '忌争抢、忌超量' }
    },
    sport: {
      妻财: { role: '我克者为妻财，主可支配、可耗用之物', xiang: '健身器材、自行车、跑鞋护具等装备，以及课程与场地花费', yi: '选趁手合适的装备', ji: '忌装备攀比、忌带伤硬上器械' },
      子孙: { role: '我生者为子孙，主舒展、释放与恢复', xiang: '舒展释放、运动后的舒畅感、恢复力、项目本身的趣味性', yi: '优先保证趣味与恢复', ji: '忌练到毫无愉悦、练完更累' },
      官鬼: { role: '克我者为官鬼，主损伤、耗损、压力', xiang: '扭伤拉伤、过度疲劳、伤病隐患，以及被迫的训练压力', yi: '减量，不适请咨询专业人士', ji: '忌带伤坚持、忌冲极限' },
      父母: { role: '生我者为父母，主承载、庇护、传统方式与理论', xiang: '传统功法（八段锦、太极、五禽戏）、训练理论、场馆规矩、护具与教练指导', yi: '先学标准动作，打基础', ji: '忌只学理论不上手、忌不懂装懂蛮练' },
      兄弟: { role: '同我者为兄弟，主同辈、陪伴、竞争', xiang: '同伴、对手、团队对抗，以及分摊的场地费用', yi: '结伴同行', ji: '忌胜负心过重、忌盲目跟别人强度' }
    },
    fun: {
      妻财: { role: '我克者为妻财，主可支配、可花费之物', xiang: '花费、门票、消费性项目，即"要花钱才能玩的东西"', yi: '适度投入换取体验', ji: '忌冲动消费、忌以花钱代替陪伴' },
      子孙: { role: '我生者为子孙，主欢愉、消遣与产出', xiang: '玩乐欢愉本身、消遣、笑声、放松感', yi: '保证尽兴', ji: '忌玩完更累、更空虚' },
      官鬼: { role: '克我者为官鬼，主扫兴、麻烦、安全隐患', xiang: '扫兴之事、排队纠纷、过度刺激、安全隐患', yi: '回避该形式', ji: '忌涉赌、涉险、深夜独行' },
      父母: { role: '生我者为父母，主承载、庇护、传统方式与理论', xiang: '传统文化活动（庙会、灯会、戏曲、民俗体验）、场馆展览、行程安排与规矩', yi: '选有文化底蕴的活动', ji: '忌安排过满变成任务' },
      兄弟: { role: '同我者为兄弟，主同辈、陪伴、群体', xiang: '朋友、同伴、群体、社交局', yi: '与人分享', ji: '忌人数过多失焦、忌应酬式相聚' }
    },

    loveM: {
      妻财: { role: '我克者为妻财，此处为所测之人', xiang: '对方（她的心意、态度与去向），是本占的太极对象', yi: '取旺相生合世爻者，主两情相投', ji: '忌空破（对方无意或身不由己）、忌化退神' },
      子孙: { role: '我生者为子孙，此处为相处中的轻松愉悦', xiang: '两人相处的自在感、愉悦与互动的顺畅', yi: '旺则相处轻快', ji: '忌休囚则相处生分拘束' },
      兄弟: { role: '同我者为兄弟，此处为竞争者与阻隔', xiang: '情敌、竞争者、横在中间的干扰者', yi: '宜其衰静', ji: '忌发动则有人争夺、忌旺而克世' },
      父母: { role: '生我者为父母，此处为长辈媒妁与婚约文书', xiang: '双方长辈的态度、媒妁之言、婚约与登记文书', yi: '旺相不空主长辈赞成、婚书有着落', ji: '忌空破则长辈不允或婚事无凭' }
    },
    loveF: {
      官鬼: { role: '克我者为官鬼，此处为所测之人', xiang: '对方（他的态度、处境与是否可靠），是本占的太极对象', yi: '取旺相得地、生合世爻者', ji: '忌空破（其人虚而不实或无意）、忌旺而克世（对我有伤）' },
      妻财: { role: '我克者为妻财，此处为我的心意与付出', xiang: '我的投入、为这段关系付出的时间与钱财，也是生官的根基', yi: '有气则我心意足、能生助对方', ji: '忌空破则付出无着落' },
      子孙: { role: '我生者为子孙，此处为制官之变数（子孙生妻财、妻财克官鬼）', xiang: '变卦、冷淡、让我犹豫不决的因素（子孙生妻财、妻财克官鬼，官鬼受制）', yi: '宜其衰静', ji: '忌发动旺相则对方退意或事有变' },
      兄弟: { role: '同我者为兄弟，此处为竞争者', xiang: '情敌与其他追求者', yi: '宜其衰静', ji: '忌发动则有人介入' }
    },
    wealth: {
      妻财: { role: '我克者为妻财，此处为所求之财利', xiang: '这笔钱、这笔生意的利润与可动用的资金', yi: '取旺相得地、来生世爻者主可得', ji: '忌空破休囚（财虚难得）、忌被兄弟劫夺' },
      子孙: { role: '我生者为子孙，此处为财源活水', xiang: '客户来源、生财的路子、能带来现金流的事', yi: '旺则财有根、源源不断', ji: '忌休囚空破则财无源，纵得亦不长久' },
      兄弟: { role: '同我者为兄弟，此处为劫财破耗', xiang: '同行竞争、分利之人、意外破耗与开销', yi: '宜其衰静', ji: '忌发动则利润被分夺、忌旺而克世主亏' },
      父母: { role: '生我者为父母，此处为本钱与劳苦', xiang: '投入的本钱、店铺厂房、辛苦经营之事', yi: '旺则根基厚', ji: '忌动而克世主劳多利少' }
    },
    child: {
      子孙: { role: '我生者为子孙，此处为胎孕子女缘', xiang: '胎气、子女缘、怀孕的可能与胎儿的安危', yi: '旺相得地、不空不破主缘至且安', ji: '忌空破休囚主缘迟或胎气不稳' },
      父母: { role: '生我者为父母，此处为克胎之扰', xiang: '长辈压力、繁琐规矩、不利胎产的因素（父母克子孙、生官鬼，主长辈压力与教养束缚、间接不利胎产；原神/忌神/仇神以本卦卦宫五行实算为准）', yi: '宜其衰静', ji: '忌发动旺相主不利胎产、须静养' },
      官鬼: { role: '克我者为官鬼，此处为病气惊扰', xiang: '病气、惊吓、身体上的不适与隐患', yi: '宜其衰', ji: '忌旺动克世须就医咨询' },
      兄弟: { role: '同我者为兄弟，此处为助力与陪伴', xiang: '伴侣的配合、家人的支持、同道相助', yi: '旺则有人照应', ji: '忌克世则孤力难支' }
    },
    study: {
      父母: { role: '生我者为父母，此处为成绩与文书', xiang: '考卷成绩、录取文书、榜文通知、学业本身', yi: '取旺相不空者主成绩可期', ji: '忌空破则成绩无凭、忌被妻财发动克之' },
      官鬼: { role: '克我者为官鬼，此处为名次与功名', xiang: '名次、录取名额、评定与考官的态度', yi: '旺相得地且生父母主名次有望', ji: '忌休囚则名落、忌旺而克世主压力大' },
      妻财: { role: '妻财为资粮助考、财不破印（是否原神以本卦卦宫五行实算为准）', xiang: '投入备考、买资料、托关系等花费（妻财生父母，反主助）', yi: '宜其安静不动', ji: '忌发动则财泄于外、分散精力' },
      子孙: { role: '子孙主分心松弛、动力不足（克损用神之力以本卦卦宫五行实算为准）', xiang: '玩乐分心、心思浮动（克印则失分）', yi: '宜其衰静', ji: '忌发动则学业被分心所累' },
      子孙: { role: '我生者为子孙，此处为临场发挥', xiang: '临场状态、发挥的松弛感、解忧散压之力', yi: '旺则发挥自如', ji: '忌休囚则怯场失常' }
    },
    career: {
      官鬼: { role: '克我者为官鬼，此处为职位与权柄', xiang: '职位、权力、上级与组织的态度', yi: '旺相得地、生合世爻主职运顺', ji: '忌空破则职位虚悬、忌旺而克世主受压' },
      妻财: { role: '我克者为妻财，此处为薪资与资源', xiang: '薪资报酬、可调配的资源，也是生助官鬼的根基', yi: '有气则待遇可期', ji: '忌空破则利薄' },
      子孙: { role: '我生者为子孙，此处为变故与制官（子孙生妻财、妻财克官鬼）', xiang: '变故、人事更迭、让我分心旁骛之事（子孙生妻财、妻财克官鬼，官鬼受制）', yi: '宜其衰静', ji: '忌发动旺相主职位有变、宜守不宜争' },
      父母: { role: '生我者为父母，此处为任命与规矩', xiang: '任命文书、考核制度、岗位职责', yi: '旺相不空主任命有着落', ji: '忌空破则文书无凭' }
    },
    job: {
      官鬼: { role: '克我者为官鬼，此处为应聘的职位', xiang: '这个岗位、招人方的态度与录用与否', yi: '旺相生合世爻主被取', ji: '忌空破则岗位虚设或对方无意' },
      父母: { role: '生我者为父母，此处为录用文书', xiang: 'offer、录用通知、简历与面试材料', yi: '旺相不空主文书可期', ji: '忌空破则消息无凭' },
      妻财: { role: '我克者为妻财，此处为薪资条件', xiang: '薪酬待遇、谈条件的筹码', yi: '有气则条件可谈', ji: '忌空破则待遇虚' },
      子孙: { role: '我生者为子孙，此处为变数', xiang: '临时的变动、其他机会的分心（子孙生妻财、妻财克官鬼，官鬼受制）', yi: '宜其衰静', ji: '忌发动主此事生变' }
    },
    news: {
      父母: { role: '生我者为父母，此处为音信本身', xiang: '消息、回信、通知、文件，即"所等的那句话"', yi: '旺相不空主消息将至且可信', ji: '忌空破则消息无凭或久久不至' },
      官鬼: { role: '克我者为官鬼，此处为阻滞与官方', xiang: '卡住消息的人或环节、官方口径、让人不安的因素', yi: '宜其衰', ji: '忌旺动则消息被压或带来坏消息' },
      妻财: { role: '我克者为妻财，此处为实物凭据', xiang: '随消息而来的实物、票据、包裹', yi: '有气则物信俱至', ji: '忌空破则只有话没有物' },
      子孙: { role: '我生者为子孙，此处为化解与好消息', xiang: '事情的转圜、让人安心的结果', yi: '旺则结果是好的', ji: '忌休囚则虚惊一场' }
    },
    home: {
      父母: { role: '生我者为父母，此处为宅体', xiang: '房子本身、宅基、家宅的稳定性', yi: '旺相不空主宅稳人和', ji: '忌空破则宅有损、宜修整' },
      官鬼: { role: '克我者为官鬼，此处为不安之方', xiang: '宅中不安的因素：按所在爻位定方位（初爻地基、二爻灶房、依次类推）', yi: '宜其衰静受制', ji: '忌旺动则该方有事、须查修' },
      子孙: { role: '我生者为子孙，此处为宅中安宁', xiang: '家宅的安宁、能制官鬼的化解之力', yi: '旺则病气散、宅安', ji: '忌休囚则不安难解' },
      兄弟: { role: '同我者为兄弟，此处为同住之人', xiang: '家人、室友、邻居之间的口舌与相处', yi: '宜其安静', ji: '忌发动则口舌纷争' }
    },
    lawsuit: {
      官鬼: { role: '克我者为官鬼，此处为官府与判决', xiang: '官府、法官、判决结果这股"管我的力量"', yi: '生合世爻则有利于我', ji: '忌旺而克世主判我不利、忌持世则缠讼' },
      子孙: { role: '我生者为子孙，此处为和解之门', xiang: '和解的可能、调解人、撤诉与化解之道（子孙生妻财、妻财克官鬼，官鬼受制）', yi: '旺相主可调可和', ji: '忌空破则和解无门' },
      妻财: { role: '我克者为妻财，此处为钱债与赔偿', xiang: '涉案的钱财、赔偿金额、诉讼成本', yi: '有气则钱债有着落', ji: '忌空破则赔付无着' },
      兄弟: { role: '同我者为兄弟，此处为对方同伙与费用', xiang: '对方一方的助力、以及打官司的分摊开销', yi: '宜其衰', ji: '忌发动则对方人多势众、耗费增加' }
    },
    illness: {
      官鬼: { role: '克我者为官鬼，此处为病症（事理之忌）', xiang: '病症本身，所在爻位提示病处、五行提示性质', yi: '宜其衰弱受制、宜子孙旺而制之', ji: '忌旺动克世、忌持世，病势重须就医' },
      子孙: { role: '我生者为子孙，此处为医药与痊愈之望', xiang: '医药、医生、治疗手段与身体的恢复力', yi: '旺相得地主药对症、可向愈', ji: '忌空破休囚则药不对症或恢复缓慢' },
      妻财: { role: '我克者为妻财，此处为饮食与助病之源', xiang: '饮食所伤、生痰生湿之源（财生官鬼）', yi: '宜清淡有节', ji: '忌旺而生官鬼主病情加重' },
      兄弟: { role: '同我者为兄弟，此处为元气与照应', xiang: '自身元气、陪护的家人', yi: '旺则有人照应、底子尚可', ji: '忌休囚则元气不足' }
    },
    travel: {
      官鬼: { role: '克我者为官鬼，此处为凶险与阻滞', xiang: '路途上的凶险、意外、被阻滞之事', yi: '宜其衰静受制', ji: '忌旺动克世，须改期或加倍谨慎' },
      父母: { role: '生我者为父母，此处为行李车船', xiang: '行李、车船航班、行程安排与劳苦', yi: '有气不空主行程有着落', ji: '忌动而克世主劳顿误程、忌空破则车船误点' },
      妻财: { role: '我克者为妻财，此处为盘缠', xiang: '旅费、盘缠与路上的用度', yi: '有气则资斧充足', ji: '忌空破则资费不继、忌兄弟劫夺' },
      子孙: { role: '我生者为子孙，此处为一路平安', xiang: '旅途的顺遂、能化解凶险的护佑（子孙生妻财、妻财克官鬼，官鬼受制）', yi: '旺则一路平安', ji: '忌休囚则小状况不断' }
    },
    person: {
      父母: { role: '生我者为父母，此处为音信', xiang: '行人的音信、联系、归来的消息', yi: '旺相不空主有信可通', ji: '忌空破则音信杳然' },
      官鬼: { role: '克我者为官鬼，此处为途中阻滞', xiang: '路上受阻、被事牵绊、让人担心的因素', yi: '宜其衰', ji: '忌旺动主途中不顺或有险' },
      妻财: { role: '我克者为妻财，此处为行囊资费', xiang: '行囊、随身财物、路上的用度', yi: '有气则人在物在', ji: '忌空破主财物失落' },
      子孙: { role: '我生者为子孙，此处为归途顺遂', xiang: '归途的顺畅、化解阻滞之力', yi: '旺则归期可待', ji: '忌休囚则迟迟不归' }
    },
    lost: {
      妻财: { role: '我克者为妻财，此处为所失之物', xiang: '所失之物（丢失的东西本身），是本占的太极对象', yi: '旺相不空主物未失尽、可寻', ji: '忌空破休囚主难寻、忌化退神' },
      官鬼: { role: '克我者为官鬼，此处为贼人与阻碍', xiang: '窃取之人、阻碍寻找的因素，与玄武爻同参定方位', yi: '宜其衰静受制', ji: '忌旺动主被窃难寻' },
      子孙: { role: '我生者为子孙，此处为线索与找回之力', xiang: '线索、帮忙寻找的人、能克制贼人的力量', yi: '旺相主有线索可循', ji: '忌空破则无线索' },
      兄弟: { role: '同我者为兄弟，此处为分夺与散失', xiang: '被转手分夺、物品散落难聚', yi: '宜其衰', ji: '忌发动主已被转手' }
    }
  };

  // 六神 / 六亲取象的字符串形式（供离线解析与简版输出复用）
  function shenText(modId, shen) {
    var o = (SHEN_SEMANTIC[modId] || {})[shen];
    if (!o) return '';
    return o.xiang + '；宜' + o.yi + '；' + o.ji;
  }
  function liuqinText(modId, lq) {
    var o = (LIUQIN_SEMANTIC[modId] || {})[lq];
    if (!o) return '';
    return '传统类象：' + (LIUQIN_CLASSIC[lq] || '') + '　在' + (MODULES[modId] ? MODULES[modId].name : '') +
      '中取象为：' + o.xiang + '；宜' + o.yi + '；' + o.ji;
  }

  // ==================== 三模块属性维度 ====================
  // 各模块可落地到具体物类的"硬词表"。AI 输出时只能从下列条目里选具体物类，
  // 不得自行发明虚词（如"润养平补"须落到具体食材小类），以保证结论可执行、可核对。
  var TAXONOMY = {
    diet: {
      title: '可落地食物分类词表（输出时从下列条目选具体物类，并带分类标签）',
      groups: [
        { cat: '蛋白质类', items: ['红肉（猪·牛·羊）', '水产（鱼·虾·蟹·贝·其他水生）', '蛋奶豆（鸡蛋·牛奶·豆腐·其他豆制品）'] },
        { cat: '碳水化合物类', items: ['根茎淀粉（红薯·山药·土豆·芋头·莲藕）', '谷物（米·面·杂粮·燕麦）'] },
        { cat: '维生素·膳食纤维类', items: ['绿叶菜（菠菜·油菜·生菜·芹菜·芥蓝）', '瓜类含水菜（冬瓜·丝瓜·黄瓜·西葫芦）', '菌菇番茄及其他蔬果（番茄·菌菇·彩椒等）'] },
        { cat: '烹饪与温度', items: ['蒸·炖·煮（温软易消化）', '忌油炸·烧烤·生拌', '温热熟食、忌生冷寒凉'] }
      ]
    },
    sport: {
      title: '可落地运动分类词表（输出时从下列条目选具体项目，并带分类标签）',
      groups: [
        { cat: '强度', items: ['舒缓（散步·太极·八段锦·拉伸·瑜伽）', '中等（快走·骑车·游泳·慢跑）', '剧烈（跑步·力量训练·高强度间歇）'] },
        { cat: '方式类型', items: ['有氧（跑步·游泳·骑车·快走）', '力量（举铁·自重训练·核心）', '柔韧舒缓（瑜伽·太极·八段锦·拉伸）', '球类（篮球·羽毛球·乒乓·网球）', '户外（登山·徒步·骑行·爬山）'] },
        { cat: '场地', items: ['室内（健身房·居家·场馆）', '户外（公园·山地·操场·自然）'] },
        { cat: '社交状态', items: ['单人（独自练习）', '群体（同伴·团课·团队对抗）'] }
      ]
    },
    fun: {
      title: '可落地娱乐分类词表（输出时从下列条目选具体形式，并带分类标签）',
      groups: [
        { cat: '形式属性', items: ['静态独处（阅读·观影·单机游戏·手工）', '动态社交（聚会·桌游·唱K·出游）', '创作表达（音乐·绘画·写作·摄影）', '户外自然（露营·徒步·公园·市集）'] },
        { cat: '感官侧重', items: ['视觉（影展·画展·风景·展览）', '听觉（音乐·播客·现场演出）', '动觉（手工·运动类娱乐·舞蹈）', '社交互动（聊天·多人协作）'] },
        { cat: '对象属性', items: ['独处（自我充电）', '好友小聚（2-4人）', '群体热闹（多人局·演唱会）'] }
      ]
    }
  };

  // ============ 六神纲（通用问事定性，不分模块）—— 检索层③ ============
  // 新增问事模块按"所属六神"归类：模块只登记 用神表/应爻定位/应期要点，
  // 卦理定性由六神纲统一给出，不逐模块重写提示词全文。
  var SHEN_DOMAIN = {
    青龙: { core: '青龙主喜庆、财禄、婚姻、生育、酒食乐事，东方木神', lens: '本组问事多涉吉庆得失：感情婚姻、财利生意、生育添口、新事之喜。青龙临用神旺相主喜庆可成，休囚空破则喜而不实；青龙动而生世，喜事近矣。' },
    朱雀: { core: '朱雀主文书、口舌、音信、官非言辞，南方火神', lens: '本组问事多涉信息与言辞：考试文书、求职应聘、事业官运、消息真假、口舌争执。朱雀临用神旺主文书音信可成；朱雀发动须防口舌生非、言辞反复。' },
    勾陈: { core: '勾陈主田土、家宅、牢狱、迟滞纠缠，中央土神', lens: '本组问事多涉不动产与拖延：家宅田土、官司纠缠、久拖不决之事。勾陈临用神主事缓成、宜耐心经营；勾陈空破则久拖无果，逢冲之期方有转机。' },
    螣蛇: { core: '螣蛇主怪异、忧疑、虚惊、缠绕不休', lens: '本组问事多涉忧疑不定：心头不安、反复缠绕、节外生枝之事。螣蛇临用神主事有反复与虚惊，宜先辨真假再行动；忌神临螣蛇则烦恼缠身难解。' },
    白虎: { core: '白虎主疾病、伤灾、丧事、道路行人，西方金神', lens: '本组问事多涉凶险与远行：疾病医药、伤灾、出行平安、行人归期。白虎临用神旺而受制（子孙临之、日月制之）则凶中有救；白虎空破反主凶势得缓。占病官鬼为病症、子孙为医药。' },
    玄武: { core: '玄武主暗昧、盗失、阴私、不明底细之事，北方水神', lens: '本组问事多涉隐晦：失物寻踪、暗昧私情、不明底细。玄武临用神主事有隐情；寻失物看玄武所临之爻定藏匿方向与何人所为，玄武受冲之期常为线索显现之时。' }
  };

  // 六神在"问事类"占断中的宜忌（模块层未专设时的中间检索层）
  var SHEN_QA = {
    青龙: { xiang: '喜庆将至、贵人助力，财禄婚育之吉兆', yi: '宜进取、宜争取喜庆之事', ji: '忌休囚空破则喜而不实' },
    朱雀: { xiang: '文书音信将至，亦主口舌争执与言辞反复', yi: '宜文书、应试、陈情表白', ji: '忌口舌生非、忌听信传言' },
    勾陈: { xiang: '事多迟滞纠缠，田土家宅之牵绊', yi: '宜耐心经营、宜守不宜进', ji: '忌急躁冒进，空破则久拖无果' },
    螣蛇: { xiang: '忧疑不定、反复缠绕、虚惊怪异', yi: '宜先辨真假再行动', ji: '忌轻信、忌反复更改主意' },
    白虎: { xiang: '凶险伤灾、疾病道路之象', yi: '宜守静、宜求医药与救护', ji: '忌硬闯冒险，旺动克世须防伤病' },
    玄武: { xiang: '暗昧不明、隐情失脱', yi: '宜暗中查访、宜谨慎保管财物', ji: '忌与人暧昧不明、忌轻露底细' }
  };

  // ============ 模块语气与风险约束（注入提示词尾部）—— 检索层④ ============
  // 问事类模块共用同一套 SOP，但高风险领域（疾病/官讼/出行/人身/生育）必须各有措辞底线，
  // 避免模型在所有模块里说同一句话、或在不该断言的领域给出确定性结论。
  var RISK_NOTE = {
    general: '不作宿命断言；涉健康、法律、财务的判断一律追加"请咨询专业人士或机构"的提示。',
    illness: '语气克制谨慎：只作卦象趋势提示，不得给出诊断结论、药名、剂量或停药建议；任何不适提示就医，急症提示立即就医。',
    lawsuit: '语气中立：只论卦象趋势，明确声明不构成法律意见，重大纠纷须咨询律师与专业机构。',
    num: '声明属易理趣味推演：不作精确数字承诺，不构成投资或博彩依据。',
    travel: '不作"绝对安全"承诺；恶劣天气、夜路、高风险行程须提示以现实信息为准并考虑推迟。',
    person: '不作"人在何处"的确定性断言；失联超期须提示联系警方。',
    child: '不得作怀孕与否的确定性断言，以医学检查为准；不得涉及性别选择。',
    fyear: '不得断言生死、重大疾病与不可逆事件，只作趋势提示。',
    fweek: '只作一周趋势提示，不作确定性断言。',
    misc: '含糊问题先请用户明确所问再断；不作宿命断言。',
    lost: '不作"必定找回"承诺；涉及他人时不得断言具体是谁所为。',
    loveM: '不作对方心意的确定性断言；涉及婚姻大事须提示以现实沟通为准。',
    loveF: '不作对方心意的确定性断言；涉及婚姻大事须提示以现实沟通为准。',
    wealth: '不作收益承诺；涉及投资借贷须提示风险与专业咨询。',
    career: '不作晋升的确定性承诺；重大职业决策须提示以现实信息为准。',
    job: '不作录用的确定性承诺；以对方正式通知为准。',
    study: '不作分数与录取的确定性承诺；以官方成绩与通知为准。',
    home: '不作风水改运的确定性承诺；涉及房屋安全须提示专业检修。',
    news: '不作消息真假的确定性断言；以官方或当事人确认为准。'
  };

  // ============ 各模块的默认问法（用户不填时，用它作为占问原文） ============
  // 用户多半不会输入问题。若留空，就用该模块自己的默认问法喂给模型，
  // 让模型有具体问题可正面回答，而不是对着"未填写"空转。
  var ASK_DEFAULT = {
    diet: '最近想调理饮食，吃什么、怎么吃对我现在的状态最好？',
    sport: '最近想动一动，练什么、练多猛适合我现在的身体？',
    fun: '最近有点累，玩什么、怎么放松对我最合适？',
    general: '我心里有一件事想问能不能成、什么时候成（若方便请写具体是什么事）。',
    loveM: '我想问这段感情能不能成，她对我的态度到底如何？',
    loveF: '我想问这段感情能不能成，他这个人靠不靠谱？',
    wealth: '我想问这笔财能不能得、什么时候能到手？',
    child: '我想问子女缘：有没有、什么时候会有消息？',
    study: '我想问这次考试能不能过、名次怎么样？',
    career: '我想问事业：是该守还是该动、有没有升的机会？',
    job: '我想问这份工作能不能成、什么时候有回音？',
    news: '我想问这条消息来不来、是真是假？',
    home: '我想问家里安不安、问题出在哪一处？',
    lawsuit: '我想问这桩官司谁占理、能不能赢、什么时候能了结？',
    illness: '我想问这个病势轻重、能不能好、什么时候好转？',
    travel: '我想问这趟出行宜不宜行、顺不顺利？',
    person: '我想问这个人什么时候回来、人在外是否平安？',
    lost: '我想问这个东西能不能找回、大概在哪里？',
    num: '我想问这组号码的吉凶偏向（仅供娱乐参考）。',
    misc: '我有一件杂事想问吉凶（若方便请写具体是什么事）。',
    fweek: '我想问这一周的运势起伏、哪天需要留意？',
    fyear: '我想问（选一）：① 这一年的运程顺逆、关键节点在几月？　② 我的终身根基强弱、命局落在哪步大运？（查终身运请同时填出生年）'
  };

  // 首页分组展示顺序（生活调理为大卡，其余按六神分组）
  var MOD_GROUPS = [
    { key: 'life', name: '生活调理', ids: ['diet', 'sport', 'fun'] },
    { key: 'general', name: '通用问事', ids: ['general', 'fweek', 'fyear'] },
    { key: '青龙', name: '青龙 · 喜庆财婚', ids: ['loveM', 'loveF', 'wealth', 'child'] },
    { key: '朱雀', name: '朱雀 · 文书音信', ids: ['study', 'career', 'job', 'news'] },
    { key: '勾陈', name: '勾陈 · 家宅纠缠', ids: ['home', 'lawsuit'] },
    { key: '白虎', name: '白虎 · 疾病道路', ids: ['illness', 'travel', 'person'] },
    { key: '玄武', name: '玄武 · 暗昧失脱', ids: ['lost', 'num'] },
    { key: '螣蛇', name: '螣蛇 · 忧疑缠绕', ids: ['misc'] }
  ];

  var MODULES = {
    diet: {
      id: 'diet', name: '饮食占', icon: '🍚', color: '#C0703C', color2: '#F3E2CE',
      subtitle: '吃什么 · 吃多少 · 怎么吃',
      desc: '以世爻为你此刻的身体状态，妻财爻为食禄，子孙爻为运化吸收',
      yongshen: '妻财', yuanshen: '子孙', jishen: '兄弟', choushen: '父母',
      dims: ['食物种类', '颜色属性', '分量尺度', '制作方法', '温度与口味', '进食节奏', '进食时段'],
      taxonomy: TAXONOMY.diet, group: 'life', yingDesc: '吃喝的东西'
    },

    sport: {
      id: 'sport', name: '运动占', icon: '🏃', color: '#2F7A6A', color2: '#D7EDE6',
      subtitle: '在哪练 · 练多猛 · 怎么练',
      desc: '以世爻为你当下的体力储备，子孙爻为舒展释放，官鬼爻为耗损伤病',
      yongshen: '子孙', yuanshen: '兄弟', jishen: '父母', choushen: '官鬼',
      dims: ['场地属性', '剧烈程度', '方式类型', '身体状态', '社交状态', '时长与恢复'],
      taxonomy: TAXONOMY.sport, group: 'life', yingDesc: '运动的方式'
    },

    fun: {
      id: 'fun', name: '娱乐占', icon: '🎈', color: '#6A4C93', color2: '#E7DFF3',
      subtitle: '玩多久 · 跟谁玩 · 怎么玩',
      desc: '以世爻为你当下的心境，子孙爻为欢愉收益，父母爻为操劳克制',
      yongshen: '子孙', yuanshen: '兄弟', jishen: '父母', choushen: '官鬼',
      dims: ['时段与时长', '形式属性', '对象属性', '感官侧重', '精神收益'],
      taxonomy: TAXONOMY.fun, group: 'life', yingDesc: '娱乐的对象'
    },

    general: {
      id: 'general', name: '通用问事', icon: '🧭', color: '#5F5E5A', color2: '#E3E1DA',
      subtitle: '此事成不成 · 何时成 · 卡在哪',
      desc: '以世爻为求测者、应爻为所问之事；用神随问事取，无明确对象时以世爻旺衰为纲',
      yongshen: '兄弟', yuanshen: '父母', jishen: '官鬼', choushen: '子孙',
      yongshenNote: '通用占先按问事取用神：问人看其所对应六亲、问物看妻财、问文书契约看父母、问病看官鬼与子孙；无明确对象时以世爻旺衰与世应关系为纲',
      yingDesc: '所问之事本身', group: 'general', useGeneral: true,
      focus: '以成败＋应期为主线：成不成看用神旺衰与世应生克、卡在哪看间爻与忌神动爻；应期按规则推断——用神旺相取生合之日、旬空看出空填空、月破看逢合出月、入墓看冲开、动爻看逢值逢合'
    },

    loveM: {
      id: 'loveM', name: '感情婚姻·男占', icon: '💘', color: '#C25B6E', color2: '#F6DEE3',
      subtitle: '她有心吗 · 能成吗 · 何时成',
      desc: '以世爻为你自身，妻财爻为对方（所测之人），世应生克与六合成合定两情',
      yongshen: '妻财', yuanshen: '子孙', jishen: '兄弟', choushen: '父母',
      yingDesc: '对方（所测之人）', group: '青龙', shen: '青龙', useGeneral: true,
      focus: '男占感情以妻财为对方：世应相生相合主两情相投、相克相冲主隔阂；间爻（二三爻与四五爻）为阻隔；六合卦主和合、六冲卦主散；应期取世应相合或用神旺相生合之日'
    },

    loveF: {
      id: 'loveF', name: '感情婚姻·女占', icon: '💗', color: '#B04A63', color2: '#F6DEE3',
      subtitle: '他可靠吗 · 能成吗 · 何时成',
      desc: '以世爻为你自身，官鬼爻为对方（所测之人），财爻为其心意根基',
      yongshen: '官鬼', yuanshen: '妻财', jishen: '子孙', choushen: '兄弟',
      yingDesc: '对方（所测之人）', group: '青龙', shen: '青龙', useGeneral: true,
      focus: '女占感情以官鬼为对方：官鬼旺衰定其人状态、子孙动则生妻财、妻财克官须防变卦；世应生克与六合成合定两情；应期取官鬼生旺逢值或世应相合之日'
    },

    wealth: {
      id: 'wealth', name: '财运/生意', icon: '💰', color: '#A67C1B', color2: '#F3E9CE',
      subtitle: '这笔财能不能得 · 何时得',
      desc: '以世爻为你自身，妻财爻为财利，子孙爻为财源，兄弟爻为劫财破耗',
      yongshen: '妻财', yuanshen: '子孙', jishen: '兄弟', choushen: '父母',
      yingDesc: '所求之财／生意本身', group: '青龙', shen: '青龙', useGeneral: true,
      focus: '财爻旺衰定盈亏、子孙为财源（财源旺则财有根）、兄弟动则劫财防破耗；世克应或财来生世主可得；应期取财爻旺相生合之日、忌兄弟值日与财爻空破之期'
    },

    child: {
      id: 'child', name: '怀孕/子女缘', icon: '🍼', color: '#3B8A5A', color2: '#DCEFE4',
      subtitle: '有没有 · 安不稳 · 何时应',
      desc: '以子孙爻为胎产子女缘，父母爻旺动不利胎产，青龙临之主喜庆',
      yongshen: '子孙', yuanshen: '兄弟', jishen: '父母', choushen: '官鬼',
      yingDesc: '胎孕／子女缘本身', group: '青龙', shen: '青龙', useGeneral: true,
      focus: '问生育看子孙爻：旺相得生主缘至、空破休囚主缘迟；父母爻旺动不利胎产须静养；官鬼动防病气惊扰；应期取子孙旺相逢值逢合之期'
    },

    study: {
      id: 'study', name: '学业/考试', icon: '📚', color: '#185FA5', color2: '#DCE9F8',
      subtitle: '考得过吗 · 名次如何 · 何时放榜',
      desc: '以父母爻为用神（成绩文书），原神/忌神/仇神以本卦卦宫五行实算的用神生克图为准（程序按卦宫逐卦推导：生父母者为原神、克父母者为忌神、生忌神者为仇神）；官鬼爻参看名次功名（官鬼与父母的生克以本卦卦宫五行实算为准）',
      yongshen: '父母', yuanshen: '官鬼', jishen: '妻财', choushen: '子孙',
      yingDesc: '考试／学业本身', group: '朱雀', shen: '朱雀', useGeneral: true,
      focus: '父母爻为用神＝成绩文书、旺相主成绩佳；原神/忌神/仇神以本卦卦宫五行实算为准（生父母者为原神、克父母者为忌神、生忌神者为仇神，依卦宫推导，不由文案写死）；官鬼为名次功名、仅作参看（官鬼与父母的生克随卦宫而定）；应期取父母旺相逢值之日、文书出空之期'
    },

    career: {
      id: 'career', name: '事业官运', icon: '💼', color: '#4A5FB0', color2: '#E0E4F6',
      subtitle: '能不能升 · 该守该动 · 何时转机',
      desc: '以官鬼爻为职位权柄，世爻为你自身处境，子孙旺动不利官运',
      yongshen: '官鬼', yuanshen: '妻财', jishen: '子孙', choushen: '兄弟',
      yingDesc: '事业职位本身', group: '朱雀', shen: '朱雀', useGeneral: true,
      focus: '官鬼旺衰定职运起伏、世爻得生得地定自身处境；财爻生官为助力、子孙旺动生妻财、妻财克官须防变故；应期取官鬼生旺逢值逢合之期'
    },

    job: {
      id: 'job', name: '求职应聘', icon: '📝', color: '#3F7CB8', color2: '#DDEBF6',
      subtitle: '这份工作能不能成 · 何时有信',
      desc: '以官鬼爻为职位，父母爻为录用文书，世爻得生主我被取',
      yongshen: '官鬼', yuanshen: '妻财', jishen: '子孙', choushen: '兄弟',
      yingDesc: '应聘的职位本身', group: '朱雀', shen: '朱雀', useGeneral: true,
      focus: '官鬼为职位、父母为录用文书，两爻俱旺又生合世爻主成；应爻空破主对方无意；应期取官鬼父母旺相逢值之日、文书出空之期'
    },

    news: {
      id: 'news', name: '消息联络', icon: '📨', color: '#B8722C', color2: '#F6E7D4',
      subtitle: '消息真假 · 何时有信',
      desc: '以父母爻为音信文书，朱雀主信息口舌，空破则消息无凭',
      yongshen: '父母', yuanshen: '官鬼', jishen: '妻财', choushen: '子孙',
      yingDesc: '所等之消息本身', group: '朱雀', shen: '朱雀', useGeneral: true,
      focus: '父母爻为用神＝音信：旺相主消息将至且可信、空破主消息无凭或迟滞；原神/忌神/仇神以本卦卦宫五行实算为准（生父母者为原神、克父母者为忌神、生忌神者为仇神，依卦宫推导，不由文案写死；官鬼与父母的生克随卦宫而定）；朱雀发动防口舌传讹；应期取父母爻出空逢值或旺相生合之日'
    },

    home: {
      id: 'home', name: '家宅风水', icon: '🏠', color: '#6B7C3A', color2: '#E8EFDA',
      subtitle: '宅安不安 · 何方有事 · 何时化解',
      desc: '以父母爻为用神（宅体），官鬼仅参看何爻主何方不安（原神/忌神/仇神以本卦卦宫五行实算为准：生父母者为原神、克父母者为忌神、生忌神者为仇神，依卦宫推导，不由文案写死；官鬼与父母的生克随卦宫而定），子孙旺则宅安宁',
      yongshen: '父母', yuanshen: '官鬼', jishen: '妻财', choushen: '子孙',
      yingDesc: '家宅本身', group: '勾陈', shen: '勾陈', useGeneral: true,
      focus: '父母爻为宅体旺则宅稳；官鬼在初爻主地基、二爻主灶房、依次类推定何方不安；子孙爻旺动则宅安宁病气散；应期看官鬼发动逢冲之日或宅爻旺相之期'
    },

    lawsuit: {
      id: 'lawsuit', name: '官司诉讼', icon: '⚖️', color: '#8A4A3A', color2: '#F2DFD8',
      subtitle: '谁占理 · 能不能赢 · 何时了结',
      desc: '以官鬼爻为官府判决，世爻为我、应爻为彼，子孙动则主和解',
      yongshen: '官鬼', yuanshen: '妻财', jishen: '子孙', choushen: '兄弟',
      yingDesc: '这桩官司本身', group: '勾陈', shen: '勾陈', useGeneral: true,
      focus: '官鬼为官府：世旺应衰我胜、应旺世衰彼强；子孙发动主和解之门、官鬼空破主官不深究；应期取官鬼逢值或世爻得生之日、结案看官鬼受制之期'
    },

    illness: {
      id: 'illness', name: '疾病/医药', icon: '💊', color: '#9C3B3B', color2: '#F5DDDD',
      subtitle: '病势轻重 · 能不能愈 · 何时好转',
      desc: '以世爻为病人，官鬼爻为病症亦为用神（病体）；原神/忌神/仇神以本卦卦宫五行实算的用神生克图为准（生官鬼者为原神、克官鬼者为忌神、生忌神者为仇神，依卦宫推导，不由文案写死）；子孙爻为医药象（子孙与官鬼的生克随卦宫而定）',
      yongshen: '官鬼', yuanshen: '父母', jishen: '妻财', choushen: '子孙',
      yongshenNote: '占病以世爻为病人、官鬼为病症亦为用神（病体，官鬼五行随本卦卦宫而定，非固定属水）；原神/忌神/仇神以本卦卦宫五行实算的用神生克图为准（生官鬼者为原神、克官鬼者为忌神、生忌神者为仇神，依卦宫推导，不由文案写死）；子孙爻为医药象（医药之效依子孙与官鬼的卦宫生克而定，子孙克官鬼为克而能愈之象，依卦宫实算）。官鬼旺衰定病体轻重、原神旺主病易退、忌神动主病进；急症立即就医',
      yingDesc: '这场病本身', group: '白虎', shen: '白虎', useGeneral: true,
      focus: '官鬼旺衰定病势轻重、所在爻位定病处、所属五行定病症性质；子孙为医药：旺相有气主药有效、空破主药不对症；应期看出空、官鬼受制或子孙值日之期为转机；涉病务必提示就医'
    },

    travel: {
      id: 'travel', name: '出行平安', icon: '🧳', color: '#2F7A6A', color2: '#D7EDE6',
      subtitle: '宜不宜行 · 顺不顺利 · 何时宜动',
      desc: '以世爻为行人，官鬼为凶险宜静衰，父母动主行李劳苦阻程',
      yongshen: '妻财', yuanshen: '子孙', jishen: '兄弟', choushen: '父母',
      yingDesc: '这趟出行本身', group: '白虎', shen: '白虎', useGeneral: true,
      focus: '世爻旺相得生主行旅平安；官鬼发动主有凶险阻滞、父母发动主行李车船劳苦误程；子孙爻旺一路有护；应期取世爻出空逢生、官鬼受制之日为宜动之期'
    },

    person: {
      id: 'person', name: '行人归来', icon: '🚶', color: '#4E6E8E', color2: '#DFE9F2',
      subtitle: '人在何方 · 归不归 · 何时归',
      desc: '先按所测之人取用神（占父母看父母爻……），再看其爻动静与音信',
      yongshen: '父母', yuanshen: '官鬼', jishen: '妻财', choushen: '子孙',
      yongshenNote: '占行人归期须按所测之人的六亲取用神（父母长辈看父母爻、兄弟朋友看兄弟爻、子女晚辈看子孙爻、配偶看妻财或官鬼），本表用神仅为音信之用，兼看所测之人六亲爻的动静旺衰',
      yingDesc: '行人归期本身', group: '白虎', shen: '白虎', useGeneral: true,
      focus: '所测之人的用神爻动则人已动身、静则迟滞未归；用神空破主途中受阻；应期取用神逢值逢合、或日辰冲动用神之日（冲静则动）；父母爻兼主音信'
    },

    lost: {
      id: 'lost', name: '找寻失物', icon: '🔍', color: '#534AB7', color2: '#E6E3F8',
      subtitle: '丢在哪 · 能不能找回 · 何时有线索',
      desc: '以妻财爻为所失之物，玄武临爻看藏匿方向，兄弟动防被窃难寻',
      yongshen: '妻财', yuanshen: '子孙', jishen: '兄弟', choushen: '父母',
      yingDesc: '所失之物本身', group: '玄武', shen: '玄武', useGeneral: true,
      focus: '妻财为所失之物：旺相不空主物未失尽可寻、空破休囚主难寻；玄武所临之爻定藏匿方位与何人所为；兄弟发动主被窃；应期取财爻出空逢生、或玄武受冲线索显现之日'
    },

    num: {
      id: 'num', name: '号码预测', icon: '🔢', color: '#6A4C93', color2: '#E7DFF3',
      subtitle: '这组数偏吉还是偏凶',
      desc: '数字占以世爻用神数理参断吉凶偏向，不作精确数字承诺',
      yongshen: '兄弟', yuanshen: '父母', jishen: '官鬼', choushen: '子孙',
      yongshenNote: '数字占以世爻与用神爻的数理（爻位数、干支数、五行生数成数）参断吉凶偏向，属易理趣味推演，不作精确数字承诺',
      yingDesc: '这组号码本身', group: '玄武', shen: '玄武', useGeneral: true,
      focus: '以爻位数理与旺衰参断吉凶偏向：用神旺相主数理偏吉、休囚空破主偏滞；须声明属趣味推演，不构成任何投资或决策依据'
    },

    misc: {
      id: 'misc', name: '杂占/其它', icon: '🎲', color: '#7A6A58', color2: '#EDE8E0',
      subtitle: '没归类的杂事 · 随问取用',
      desc: '先明所问何事再取用神，忧疑缠绕之事参螣蛇所临之爻',
      yongshen: '兄弟', yuanshen: '父母', jishen: '官鬼', choushen: '子孙',
      yongshenNote: '杂占随问取用：先依用户所问明确用神（问人看六亲、问物看妻财、问文书看父母），忧疑怪异缠绕之事兼参螣蛇所临之爻；无明确对象时以世爻旺衰为纲',
      yingDesc: '所问之事本身', group: '螣蛇', shen: '螣蛇', useGeneral: true,
      focus: '先复述并明确所问何事、向用户确认用神取向，再按成败＋应期主线推断；忧疑缠绕参螣蛇临爻，主反复与虚惊'
    },

    fweek: {
      id: 'fweek', name: '周运势', icon: '📅', color: '#2C6E63', color2: '#D9EDE9',
      subtitle: '这一周的起伏与宜忌',
      desc: '以世爻旺衰为一周基调，官鬼所临定何事不顺，子孙所临定何事顺遂',
      yongshen: '兄弟', yuanshen: '父母', jishen: '官鬼', choushen: '子孙',
      yingDesc: '这一周的运势本身', group: 'general', useGeneral: true, useYearShen: true,
      focus: '以世爻旺衰为纲看一周起伏：官鬼所临之爻提示何类事不顺、子孙所临提示何类事顺遂、动爻提示变化点；六神以年干起（本周运亦从年气）；应期落在一周内的出空逢值之日'
    },

    fyear: {
      id: 'fyear', name: '终身运/年运', icon: '🎆', color: '#54431F', color2: '#EFE7D6',
      subtitle: '这一年的顺逆与大事',
      desc: '年运以世爻为全年基调，流年地支生克世爻定顺逆，动爻定大事；终身运再加出生年"年命"为命基',
      yongshen: '兄弟', yuanshen: '父母', jishen: '官鬼', choushen: '子孙',
      yingDesc: '这一年的运势本身', group: 'general', useGeneral: true, useYearShen: true,
      focus: '年运以世爻为全年基调：四柱年支生合世爻主顺、冲克世爻主逆（参排盘文本四柱）；六神以年干起（非日干）。若用户填了出生年，则以"年命（生年纳音五行）"为命基，与世爻比生克墓空破定终身根基强弱，年命生世主根基得力、年命克世主受制；绝不断言生死疾病'
    }
  };

  // ==================== 用神单一来源校正（关键）====================
  // 原神/忌神/仇神随卦宫五行而变，不能在此静态派生（此函数无 chart 上下文）。
  // 一律在运行时由 modRoles(chart, mod) 按本卦卦宫五行实算（引擎 liuqinYuanJi 为唯一权威）。
  // 用神（yongshen）以 SYM.MOD_USE 为唯一权威；其余字段一律逐卦实算，绝无第二处硬写。
  (function reconcileUseGodFromEngine() {
    var MOD_USE = (SYM && SYM.MOD_USE) || {};
    Object.keys(MODULES).forEach(function (id) {
      var m = MODULES[id];
      var useLq = MOD_USE[id];
      m.yongshen = useLq || m.yongshen; // 用神：以 MOD_USE 为唯一权威（none 模块沿用字面）
      m.useGodSource = useLq ? 'engine.liuqinYuanJi(逐卦实算)' : 'none(以世爻为纲，无固定六亲用神)';
    });
  })();

  // 逐卦实算某模块的用神/原神/忌神/仇神（用神由 resolveUseGod 动态解析：问句关键词>模块提示>世爻为纲；
  // 原神/忌神/仇神六亲身份随卦宫五行而变，唯一权威＝引擎 liuqinYuanJi）
  function modRoles(chart, mod, userText) {
    var r = (SYM && SYM.resolveUseGod) ? SYM.resolveUseGod(mod && mod.id, userText, chart) : null;
    var useLq = r ? r.useLq : (mod && mod.yongshen);
    var base = { source: r ? r.source : '模块', aux: r ? r.aux : [], taiji: '世爻', ying: r ? r.ying : null,
                 daiZhan: r ? (r.daiZhan || false) : false, tiandi: r ? r.tiandi : null,
                 // 取用置信度（high/medium/low）：由 resolveUseGod 分层匹配给出，供 chartText 标注
                 confidence: r ? (r.confidence || 'low') : 'low' };
    if (!useLq || !LY || !LY.liuqinYuanJi) {
      return Object.assign({ yongshen: useLq, yuanshen: mod && mod.yuanshen, jishen: mod && mod.jishen, choushen: mod && mod.choushen }, base);
    }
    var el = (chart && chart.ben && chart.ben.info) ? chart.ben.info.element : '金';
    var yj = LY.liuqinYuanJi(el, useLq);
    return Object.assign({ yongshen: useLq, yuanshen: yj && yj.yuan, jishen: yj && yj.ji, choushen: yj && yj.chou }, base);
  }

  // ==================== 工具函数 ====================
  function findModule(id) { return MODULES[id]; }
  // 求测者自述（选填，仅作背景，不替代卦象）
  function situationText(text, modId) {
    var t = (text || '').toString().trim();
    if (t) return t;
    return (modId && ASK_DEFAULT[modId]) ? ASK_DEFAULT[modId] : '（未填写，完全以卦象为准）';
  }
  // 占问原文：用户填写优先；未填写则用该模块的默认问法（保证模型有事可断）
  function askText(modId, text) {
    var t = (text || '').toString().trim();
    if (t) return t;
    return (modId && ASK_DEFAULT[modId]) ? ASK_DEFAULT[modId] : '（未填写，完全以卦象为准）';
  }
  // 选填栏的提示语（按模块给例子，不再统一写"脾胃"）
  function askPlaceholder(modId) {
    var def = ASK_DEFAULT[modId] || '写你这卦想问的具体心事';
    return '例如：' + def + '（留空则按默认问法起卦；也可改成你自己的话）';
  }

  function daysToZhi(dayZhi, target) {
    var a = DIZHI.indexOf(dayZhi), b = DIZHI.indexOf(target);
    var d = (b - a + 12) % 12;
    return d === 0 ? 12 : d;
  }
  var GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };

  var ZHI_WX = { 子: '水', 亥: '水', 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 辰: '土', 戌: '土', 丑: '土', 未: '土' };
  // 五行关系：返回 other 相对 me 的作用
  function wxRel(me, other) {
    if (!me || !other) return '';
    if (me === other) return '比和';
    if (WX_SHENG[other] === me) return '生我';
    if (WX_SHENG[me] === other) return '我生';
    if (WX_KE[other] === me) return '克我';
    if (WX_KE[me] === other) return '我克';
    return '';
  }
  // 某爻的状态：旺衰 + 十二长生 + 空破冲动
  function yaoStateText(y) {
    var st = [];
    st.push('旺衰' + y.wang.level + '（' + (y.wang.marks.join('、') || '无生克扶抑') + '）');
    if (y.changsheng) st.push('十二长生' + y.changsheng);
    if (y.isKong) st.push('旬空');
    if (y.isYuePo) st.push('月破');
    if (y.isRiChong) st.push('日辰相冲');
    if (y.isMoving) st.push('发动' + (y.mark || '') + (y.old ? '（' + y.old + '）' : ''));
    return st.join('，');
  }
  // 某爻的生克链：谁在生它、谁在克它（月建 / 日辰 / 动爻 / 邻爻 / 变爻回头）
  function shengkeText(y, chart) {
    var wx = y.wuxing, sheng = [], ke = [], hui = '';
    var mwx = ZHI_WX[chart.monthZhi], dwx = ZHI_WX[chart.dayZhi];
    var rm = wxRel(wx, mwx), rd = wxRel(wx, dwx);
    if (rm === '生我') sheng.push('月建（' + mwx + '）'); else if (rm === '克我') ke.push('月建（' + mwx + '）');
    if (rd === '生我') sheng.push('日辰（' + dwx + '）'); else if (rd === '克我') ke.push('日辰（' + dwx + '）');
    chart.ben.yaos.forEach(function (o) {
      if (o === y) return;
      var r = wxRel(wx, o.wuxing);
      if (r !== '生我' && r !== '克我') return;
      var who = o.posName + (o.isMoving ? '动爻' : '邻爻') + '（' + o.wuxing + '）';
      if (o.isMoving) { if (r === '生我') sheng.push(who); else ke.push(who); }
      else if (Math.abs(o.pos - y.pos) === 1) { if (r === '生我') sheng.push(who); else ke.push(who); }
    });
    // 变爻回头：动爻所化之爻对本爻的作用
    if (y.isMoving && chart.bian) {
      var by = chart.bian.yaos[y.pos - 1];
      if (by) {
        var rb = wxRel(wx, by.wuxing);
        if (rb === '生我') hui = '化回头生（变' + by.ganzhi + by.wuxing + '）';
        else if (rb === '克我') hui = '化回头克（变' + by.ganzhi + by.wuxing + '）';
        else if (rb === '比和') hui = '化同类（变' + by.ganzhi + by.wuxing + '）';
      }
    }
    return '生助：' + (sheng.length ? sheng.join('、') : '无') +
      '；克伐：' + (ke.length ? ke.join('、') : '无') +
      (hui ? '；' + hui : '');
  }
  // ============ 动爻化出之变爻：进退 / 回头 / 墓绝空破 ============
  // 进神（化进）：力量渐增、事向前推进；退神（化退）：力量渐减、事向后消退，宜退不宜进
  var HUA_JIN = { 亥: '子', 寅: '卯', 巳: '午', 申: '酉', 丑: '辰', 辰: '未', 未: '戌', 戌: '丑' };
  var HUA_TUI = { 子: '亥', 卯: '寅', 午: '巳', 酉: '申', 辰: '丑', 未: '辰', 戌: '未', 丑: '戌' };
  // 十二长生（按五行起长生，用于判断化墓/化绝）
  var CS_START = { 木: '亥', 火: '寅', 金: '巳', 水: '申', 土: '申' };
  var CS_ORDER = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
  function csStageOf(zhi, wx) {
    var s = CS_START[wx];
    if (!s) return '';
    return CS_ORDER[(DIZHI.indexOf(zhi) - DIZHI.indexOf(s) + 12) % 12];
  }
  // 动爻 y 化出变爻 by 的关系标签
  function huaRelation(y, by) {
    var tags = [];
    if (HUA_JIN[y.zhi] === by.zhi) tags.push('化进神（力量渐增，事向前推进）');
    if (HUA_TUI[y.zhi] === by.zhi) tags.push('化退神（力量渐减，事向后消退，宜退不宜进）');
    var r = wxRel(y.wuxing, by.wuxing);
    if (r === '生我') tags.push('化回头生（变爻回头生本爻，主有救应）');
    else if (r === '克我') tags.push('化回头克（变爻回头克本爻，主自招其损）');
    else if (r === '我生') tags.push('化泄气（化出泄我之气，主耗力）');
    else if (r === '我克') tags.push('化克制（化出我克者，可得但费力）');
    // 本↔变之间的合 / 刑 / 破（回头合绊尤须重视：动而受牵，吉凶皆打折）
    if (LY && LY.LIU_HE && LY.LIU_HE[y.zhi] === by.zhi) tags.push('化回头合（变爻合住本爻＝合绊：动而受牵制，其生克吉凶皆打折扣，逢冲之期应事或解绊）');
    function xingPair(a, b) {
      if (a === b) return LY && LY.ZI_XING && LY.ZI_XING.indexOf(a) >= 0;
      return !!(LY && LY.XING && LY.XING.some(function (g) { return g.zhi.indexOf(a) >= 0 && g.zhi.indexOf(b) >= 0; }));
    }
    if (xingPair(y.zhi, by.zhi)) tags.push('化回头刑（主自伤、纠纷、折磨，忌神化刑反吉）');
    if (LY && LY.PO && LY.PO[y.zhi] === by.zhi) tags.push('化回头破（变爻相破，主破损耗散）');
    var st = csStageOf(by.zhi, y.wuxing);
    if (st === '墓') tags.push('化墓（化入墓库，主受阻隐藏，待冲开方有用）');
    if (st === '绝') tags.push('化绝（化入绝地，主气绝无力）');
    if (by.isKong) tags.push('化空（变爻旬空，主虚而不实）');
    if (by.isYuePo) tags.push('化破（变爻月破，主破损不成）');
    return tags;
  }
  // 变爻的力量与它对世/应/用神的作用
  function bianYaoText(chart, mod, userText) {
    if (!chart.bian || !chart.moving.length) return null;
    var lines = ['【动爻与变爻】动爻化出之变爻，须看生克、看力量、看进退（化进则增、化退则减）'];
    var keys = [{ k: '世爻', p: chart.ben.info.shi }, { k: '应爻', p: chart.ben.info.ying }];
    if (mod) {
      var rUse = (SYM && SYM.resolveUseGod) ? SYM.resolveUseGod(mod.id, userText, chart).useLq : mod.yongshen;
      var ysYao = chart.ben.yaos.filter(function (a) { return a.liuqin === rUse; })[0];
      if (ysYao) keys.push({ k: '用神', p: ysYao.pos });
    }
    chart.moving.forEach(function (m) {
      var y = chart.ben.yaos[m.index], by = chart.bian.yaos[m.index];
      if (!y || !by) return;
      lines.push('  ' + y.posName + '：' + y.ganzhi + '（' + y.liushen + '·' + y.liuqin + '·' + y.wuxing + '）　化出　' +
        by.ganzhi + '（' + by.liuqin + '·' + by.wuxing + '）');
      var tags = huaRelation(y, by);
      lines.push('    化出关系：' + (tags.length ? tags.join('；') : '同类相化，无进退生克'));
      lines.push('    变爻力量：' + yaoStateText(by));
      var acts = [];
      keys.forEach(function (o) {
        if (o.p === y.pos) return;
        var t = chart.ben.yaos[o.p - 1];
        if (!t) return;
        var r = wxRel(t.wuxing, by.wuxing);
        if (r === '生我') acts.push('生' + o.k);
        else if (r === '克我') acts.push('克' + o.k);
      });
      lines.push('    变爻作用于他爻：' + (acts.length ? acts.join('、') : '对世应无明显生克'));
    });
    return lines.join('\n');
  }

  // 某爻的取象：六神取象 + 六亲取象（按模块检索后拼接）
  function yaoXiangText(y, modId) {
    var mod = MODULES[modId];
    var isQa = !!(mod && mod.useGeneral); // 问事类模块：模块专属 → 问事通用层 → 传统类象
    var s = (SHEN_SEMANTIC[modId] || {})[y.liushen] || (isQa ? SHEN_QA[y.liushen] : null);
    var l = (LIUQIN_SEMANTIC[modId] || {})[y.liuqin] || (isQa ? LIUQIN_QA[y.liuqin] : null);
    var modName = mod ? mod.name : '';
    var out;
    if (s) out = '六神【' + y.liushen + '】' + s.xiang + '｜宜' + s.yi + '｜' + s.ji;
    else out = '六神【' + y.liushen + '】' + ((SHEN_DOMAIN[y.liushen] || {}).core || '');
    var lqHead = '　‖　六亲【' + y.liuqin + '】' + (LIUQIN_CLASSIC[y.liuqin] || '');
    if (l) out += lqHead + '　→　' + (modName ? '在' + modName + '中' : '') + '取象为：' + (l.role ? ('（' + l.role + '）') : '') + l.xiang + '｜宜' + l.yi + '｜' + l.ji;
    else out += lqHead + '（本模块未另设专属取象，按传统类象直解）';
    return out;
  }

  // 日月架构（主＝月建提纲 / 辅＝日辰执行 / 钩子＝排盘六爻干支）与日月关系
  function riyueArchText(chart) {
    var mz = chart.monthZhi, dz = chart.dayZhi;
    var lines = [];
    lines.push('【日月架构·力量根基】月建' + mz + '＝主（提纲）：定全卦旺相休囚死基线，一月恒定；日辰' + dz +
      '＝辅（执行）：在月建基调上做临生克冲合墓绝修正，并救应月破、填空亡；卦中六爻干支为钩子，只受架构作用、彼此可互作用，绝不反作用于月日。');
    var r = chart.riyue;
    if (r && r.notes && r.notes.length) lines.push('　日月关系：' + r.notes.join('；'));
    return lines;
  }

  // 逐爻日月力量（属性赋值→力量加减）与用神/忌神/世应比较
  function riyuePowerText(chart, mod, userText) {
    var lines = [];
    // 爻际量化须在**逐爻力量文本生成之前**完成：用神由问句解析，装卦时尚未确定；
    // 若留到比较段才触发，逐爻列出的是未含爻际之分、比较行却是含爻际之分，两处数字互相打架。
    var mrEarly = (mod && LY && LY.applyInterYao) ? modRoles(chart, mod, userText) : null;
    if (mrEarly && LY && LY.applyInterYao) LY.applyInterYao(chart, mrEarly.yongshen);
    lines.push('【日月力量·逐爻（条件判断→属性赋值→力量加减）】以月建' + chart.monthZhi + '为纲、日辰' + chart.dayZhi + '为执行，逐爻力量已累加如下（分数即力量，高者力强；已含爻与爻之间的合冲刑害与动爻生克）：');
    chart.ben.yaos.forEach(function (y) {
      var s = y.wang || y.strength;
      if (!s) return;
      // 爻号 1-6（初=1…上=6）：力量层面以号指称，六亲只作取象代称；爻际痕迹亦以号书写
      lines.push('  爻' + (y.idx || '') + '·' + y.posName + y.ganzhi + '（' + y.wuxing + '·' + y.liuqin + '）' + (y.isMoving ? '·动' : '') +
        '：合计 ' + s.score + '（' + s.level + '）　' + (s.marks || []).join('、') +
        (s.kongNote ? '　※' + s.kongNote : ''));
    });
    if (mod && LY && LY.compareRoles) {
      var mr = mrEarly || modRoles(chart, mod, userText); // 原神/忌神/仇神随卦宫实算；用神由 resolveUseGod 动态解析
      var cmp = LY.compareRoles(chart, { yongshen: mr.yongshen, jishen: mr.jishen, yuanshen: mr.yuanshen, choushen: mr.choushen });
      function nm(y) { return y ? y.posName + y.ganzhi : '不上卦（须取伏神）'; }
      // 阵营加减采用【有效作用力】而非各爻自身旺衰分：已过「真空无生克权」与「爻层次生克权」
      // 两道闸门——低层次爻无权作用高层次爻时其力按零计（曲炜《六爻详真》爻之四层次）。
      // 此处输出给模型的即为过滤后的值，故模型无从改取自身旺衰分重算（避空／贪生忘克之鉴）。
      var effOn = LY.ABLATION ? LY.ABLATION.yaoLayer !== false : true;
      // layerWords：只关「有效作用力」这句说明，数字照旧为过滤后的值（2×2 消融用）
      var wordsOn = LY.ABLATION ? LY.ABLATION.layerWords !== false : true;
      var vJs = (effOn && cmp.jsEff !== undefined) ? cmp.jsEff : cmp.jsScore;
      var vYuan = (effOn && cmp.yuanEff !== undefined) ? cmp.yuanEff : cmp.yuanScore;
      var vChou = (effOn && cmp.chouEff !== undefined) ? cmp.chouEff : cmp.chouScore;
      lines.push('　比较（用神' + mr.yongshen + '／忌神' + mr.jishen + '／原神' + mr.yuanshen + '／仇神' + mr.choushen + '）：用神' +
        nm(cmp.yongshen) + '＝' + cmp.ysScore + '，忌神' + nm(cmp.jishen) + '＝' + vJs +
        '，原神' + nm(cmp.yuanshen) + '＝' + vYuan + '，仇神' + nm(cmp.choushen) + '＝' + vChou + '；世＝' + cmp.shiScore + '，应＝' + cmp.yingScore + '。');
      var interOn = LY.ABLATION ? LY.ABLATION.interYao !== false : true;
      if (interOn && wordsOn) {
        // 爻际下沉后净力＝用神综合值：原神之生、忌神之克、合冲刑害**都已折进这个数**。
        // 故必须明确禁止模型再拿分项做加减——否则它会算出一个不同的数并自认为更对。
        lines.push('　（总判＝用神综合值：原神之生、忌神之克、爻与爻的合冲刑害**均已折进该数**；'
          + '忌神／原神／仇神三值只备取象，不得再对用神做一次加减，也不得改取各爻自身旺衰分重算。）');
      } else if (effOn && wordsOn) {
        lines.push('　（忌神／原神／仇神三值＝有效作用力，已按爻层次生克权过滤：静爻无权生动爻、'
          + '动爻无权克变爻；不得改取各爻自身旺衰分重算，重算亦应得同一结果。）');
      }
      if (cmp.verdict.length) lines.push('　比较结论：' + cmp.verdict.join('；') + '。');
      if (cmp.shuangXian) {
        lines.push('　用神两现：卦中' + cmp.shuangXian.count + '个' + cmp.shuangXian.lq + '爻（' +
          cmp.shuangXian.chosen + '、' + cmp.shuangXian.others.join('、') + '），按「动爻＞持世＞旺相，空破者不作主用」取' +
          cmp.shuangXian.chosen + '为用（' + cmp.shuangXian.reason + '）；未取者只作参考，不得两爻混断。');
      }
      // 应期提示（候选方向，非保证日期）
      if (LY.yingqiOf) {
        var targets = [];
        if (cmp.yongshen) targets.push({ k: '用神', y: cmp.yongshen });
        if (cmp.shi && cmp.shi !== cmp.yongshen) targets.push({ k: '世爻', y: cmp.shi });
        var yqLines = [], yqNear = [];
        targets.forEach(function (t) {
          var cands = LY.yingqiOf(t.y, chart);
          if (!cands.length) return;
          var byDay = [], noDay = [];
          cands.forEach(function (c) {
            if (!c.zhi) { noDay.push(c.tag + '——' + c.note); return; }
            byDay.push({ tag: c.tag, zhi: c.zhi, note: c.note,
              days: (c.zhi === chart.dayZhi) ? 0 : daysToZhi(chart.dayZhi, c.zhi) });
          });
          byDay.sort(function (a, b) { return a.days - b.days; });
          var s = byDay.map(function (o) {
            return o.tag + '（' + o.zhi + '日·距今第 ' + o.days + ' 天）';
          }).join('　＞　');
          if (noDay.length) s += (s ? '　＞　' : '') + noDay.join('；') + '（不以日论，按月或旬计）';
          yqLines.push(t.k + '（' + t.y.posName + t.y.ganzhi + '）：' + s + '　理据：' + byDay.map(function (o) { return o.tag + '—' + o.note; }).join('；'));
          if (byDay.length) yqNear.push(t.k + '最近一个应期：' + byDay[0].zhi + '日（距今第 ' + byDay[0].days + ' 天）——' + byDay[0].note);
        });
        if (yqLines.length) {
          lines.push('【应期提示·候选日（已换算为距今天数）】');
          yqLines.forEach(function (l) { lines.push('  ' + l); });
          yqNear.forEach(function (l) { lines.push('  ★' + l); });
          lines.push('　应期取舍：候选日已按距今天数排序，近事取最近的一个日，事远（跨月以上）则改按月令论、不取日；旬空应出空填空、月破应出月逢合、入墓应冲开、动爻应逢值逢合。第二阶段的「执行时机」必须从上列候选日中选，不得另编日期，也不得把入墓之支当吉日。');
        }
        // 时辰级应期（近事取时）：应期在当日或极近时，精确到“时辰”
        if (LY.shiChenYingqi) {
          var shiCands = [];
          targets.forEach(function (t) {
            (LY.shiChenYingqi(t.y, chart) || []).forEach(function (c) {
              if (!shiCands.some(function (x) { return x.tag === c.tag; })) shiCands.push({ k: t.k, c: c });
            });
          });
          if (shiCands.length) {
            lines.push('【应期提示·候选时辰（近事取时，应期在当日或极近时）】');
            shiCands.forEach(function (s) {
              lines.push('  ' + s.k + '（' + s.c.tag + '·' + s.c.zhi + '时）：' + s.c.when + '——' + s.c.note);
            });
            lines.push('　时辰取舍：极近之事（当日即见分晓）取上时辰；其余仍以日／月为主，第二阶段「执行时机」若断近事须从上列时辰中选，不得另编时辰。');
          }
        }
      }
    }
    lines.push('　比较规则：分数高者力强；真空归零不计入；月破得日救按出破计。分数是启发式排序的参考而非绝对值：' +
      '若卦理与本节分数或结论冲突，不得无声推翻——必须先写明冲突点（哪一爻、何理据），再给出你的取舍与理由。');
    return lines;
  }

  // 模块专属力量侧重：把通用逐爻力量落到本模块真正焦点（世爻为纲/年命根基/官鬼子孙所临/用神旺衰调强度）
  // 全部由引擎实算数据驱动（y.wang.score/level、动静、空破），不写死六亲旺衰
  function modulePowerText(chart, mod, mr) {
    var yaos = chart.ben.yaos;
    function byLq(lq) { return yaos.filter(function (y) { return y.liuqin === lq; }); }
    function top(lq) {
      var list = byLq(lq);
      if (!list.length) return null;
      return list.slice().sort(function (a, b) { return b.wang.score - a.wang.score; })[0];
    }
    function desc(y) {
      if (!y) return '本卦不显（须取伏神）';
      return y.posName + y.ganzhi + '（' + y.wang.level + '·' + y.wang.score +
        (y.isMoving ? '·动' : '') + (y.isKong ? '·空' : '') + (y.isYuePo ? '·破' : '') + '）';
    }
    var shi = yaos.filter(function (y) { return y.isShi; })[0];
    var ying = yaos.filter(function (y) { return y.isYing; })[0];
    var out = [], id = mod.id;
    if (id === 'general' || id === 'misc') {
      out.push('成败主轴＝用神' + mr.yongshen + '（' + desc(top(mr.yongshen)) + '）：旺则事可成、衰则难；' +
        (id === 'misc' ? '忧疑缠绕兼参螣蛇所临之爻（主反复虚惊）。' : '') +
        '世应：世' + desc(shi) + '、应' + desc(ying) + '，世强应弱我得势、世弱应强彼占优。');
    } else if (id === 'fweek') {
      var gg = top('官鬼'), zs = top('子孙');
      out.push('本周基调＝世爻（我）' + desc(shi) + '：旺相则整周顺、休囚则承压。');
      out.push('不顺类：官鬼所临' + desc(gg) + '，提示本周哪类事易耗损阻滞；顺遂类：子孙所临' + desc(zs) + '，提示哪类事有助力可进。动爻＝变化点。');
    } else if (id === 'fyear') {
      out.push('全年基调＝世爻（我）' + desc(shi) + '：旺相得生主全年顺、休囚受克主逆（参四柱年支生克世爻）。');
      if (chart.yearMing) out.push('年命根基：生年' + chart.birthYearGanZhi + '纳音' + chart.yearMing.ming + '，与世爻关系——' +
        (chart.yearMing.rels.length ? chart.yearMing.rels.join('；') : '平和无冲克') + '；年命生世主根基得力、克世主受制，受制须看日月救应（合扶/出墓冲开）。');
      else out.push('（终身运须填出生年立"年命"；仅填当年则按流年太岁论，年命段不显。）');
    } else if (id === 'num') {
      var nu = top(mr.yongshen);
      out.push('数理偏吉凶＝用神' + mr.yongshen + '（' + desc(nu) + '）：旺相偏吉、休囚空破偏滞。属易理趣味推演，不作精确数字承诺、不构成任何投资或决策依据。');
    } else if (id === 'person') {
      var pr = top(mr.yongshen);
      out.push('所测之人六亲＝用神' + mr.yongshen + '（' + desc(pr) + '，代占切太极点）：旺相得生主其人安顺；动则已动身、静则迟滞未归；空破主途中受阻。归期见上应期候选日/时辰。');
    } else if (id === 'sport') {
      var spU = top('子孙'), spJ = top('官鬼');
      out.push('舒展释放＝用神子孙（' + desc(spU) + '）：旺相可放开练、强度可维持（旺则上调一档、休囚打八折）；耗损伤病＝官鬼（' + desc(spJ) + '）：旺动宜降强度防伤，安静暂无虞。');
    } else if (id === 'travel') {
      var tG = top('官鬼'), tP = top('父母'), tZ = top('子孙');
      out.push('平安基调＝世爻（我）' + desc(shi) + '：旺相得生主行旅平安。凶险阻滞＝官鬼（' + desc(tG) + '）发动则宜改期或谨慎；行李劳苦＝父母（' + desc(tP) + '）发动主车船误程；一路护佑＝子孙（' + desc(tZ) + '）旺则顺。');
    }
    return out;
  }

  function chartText(chart, mod, userText) {
    var modId = mod ? mod.id : '';
    var mr = mod ? modRoles(chart, mod, userText) : null; // 原神/忌神/仇神随卦宫实算；用神由 resolveUseGod 动态解析
    var rUse = mr ? mr.yongshen : (mod && mod.yongshen); // 解析后的用神（用于六爻关键爻/用神爻判定）
    var lines = [];
    lines.push('【起卦时间】' + chart.solarText + '（' + chart.lunarText + '）' + (chart.jieqi ? '，节气：' + chart.jieqi : ''));
    var pillar = '【四柱】';
    pillar += (chart.yearGanZhi ? '年 ' + chart.yearGanZhi + '　' : '');
    pillar += '月 ' + chart.monthGanZhi + '　日 ' + chart.dayGanZhi;
    pillar += (chart.hourGanZhi ? '　时 ' + chart.hourGanZhi : '');
    lines.push(pillar);
    if (chart.gender || chart.birthDate) {
      var q = '【求测人】';
      if (chart.gender) q += '性别 ' + chart.gender;
      if (chart.birthDate) q += (chart.gender ? '；' : '') + '出生日期 ' + chart.birthDate;
      q += '（此信息仅作取用与男女区分参考，不下断言）';
      lines.push(q);
    }
    lines.push('【旬空】' + chart.xunkong.join('、') + '　【月破】' + chart.yuepo);
    // 年干为纲（终身/年运专属）：六神以年干起 + 年命命基
    if (chart.useYearShen) {
      var shenGan = chart.shenGanZhi ? chart.shenGanZhi.charAt(0) : '';
      lines.push('【年干为纲·终身/年运专属】');
      lines.push('　六神以年干「' + shenGan + '」起（非日干）：青龙朱雀等神煞随年气走，断一生或一年之气数以此为准；' +
        (chart.birthYearGanZhi ? '（取出生年干' + chart.birthYearGanZhi.charAt(0) + '，立终身命基）' : '（未填出生年，按当年太岁' + (chart.yearGanZhi || '') + '论年运）'));
      if (chart.yearMing) {
        lines.push('　年命：生年' + chart.birthYearGanZhi + '纳音属' + chart.yearMing.ming + '；世爻' + (chart.yearMing.shiZhi || '') + '。命基与世爻关系：' +
          (chart.yearMing.rels.length ? chart.yearMing.rels.join('；') : '平和无冲克'));
        lines.push('　终身运解读须以"年命↔世爻"为根基调，再合日月旺衰与动爻论流年起伏；年命受克/入墓/空破者，根基有损，须看救应（日月合扶、出墓冲开）方定吉凶。');
      } else {
        lines.push('　（提示：若查终身运，请在前端填入出生年，系统将据生年纳音立"年命"与世爻比根基强弱；仅填当年则按流年太岁论。）');
      }
    }
    riyueArchText(chart).forEach(function (l) { lines.push(l); });
    lines.push('【本卦】' + chart.ben.name + '（' + chart.ben.upper.name + '上' + chart.ben.lower.name + '下），' + chart.ben.info.palaceName + '，属' + chart.ben.info.element + (chart.ben.info.tag ? '，' + chart.ben.info.tag : ''));
    lines.push('【世应定位】世爻＝求测者本人（我，太极点）；应爻＝本次所问之"物/事"本身' +
      (mod && mod.yingDesc ? '：在' + mod.name + '中，应爻即' + mod.yingDesc : '') + '。');
    lines.push('【世应】世在' + chart.ben.info.shi + '爻，应在' + chart.ben.info.ying + '爻');

    lines.push('【六爻明细】（自初爻至上爻；每爻给出：类型取象 → 所处状态 → 生克环境）');
    if (chart.moving && chart.moving.length >= 4) {
      lines.push('【多爻乱动】本卦' + chart.moving.length + '个爻发动，信号多头：解析必须以用神为纲收束，忌逐爻平均用力、面面俱到；动爻皆围绕用神与世应论事，静爻亦须点出。');
    }
    chart.ben.yaos.forEach(function (y) {
      var role = [];
      if (y.shiTag === '世') role.push('世＝我');
      if (y.shiTag === '应') role.push('应＝所问之物');
      var head = '  ' + y.posName + '：' + y.ganzhi + '　' + y.liushen + '　' + y.liuqin + '　' + y.wuxing +
        (role.length ? '　【' + role.join('，') + '】' : '');
      lines.push(head);
      lines.push('    取象：' + yaoXiangText(y, modId));
      lines.push('    状态：' + yaoStateText(y));
      // 生克环境只给关键爻（世、应、用神），避免篇幅失控
      var isKey = (y.shiTag === '世' || y.shiTag === '应' || (mod && rUse && y.liuqin === rUse));
      if (isKey) lines.push('    生克：' + shengkeText(y, chart));
    });

    if (chart.bian) {
      lines.push('【变卦】' + chart.bian.name + '（' + chart.bian.upper.name + '上' + chart.bian.lower.name + '下）');
      chart.bian.yaos.forEach(function (y) {
        if (!y.isChanged) return;
        lines.push('  变' + y.posName + '：' + y.ganzhi + '　' + y.liushen + '　' + y.liuqin + '　' + y.wuxing +
          (y.isKong ? '（空）' : '') + (y.isYuePo ? '（月破）' : '') + '　状态：' + yaoStateText(y));
      });
    } else {
      lines.push('【变卦】无动爻，六爻安静，为静卦，势缓而少变。');
    }

    // 伏神（本宫首卦同位爻）——用神不上卦时的取用依据
    if (chart.ben.fu && chart.ben.fu.length) {
      lines.push('【伏神】本宫' + chart.ben.info.palaceName + '之伏神（自初爻至上爻）：' +
        chart.ben.fu.map(function (f) {
          return ['初', '二', '三', '四', '五', '上'][f.pos - 1] + '爻' + f.ganzhi + '（' + f.liuqin + '）';
        }).join('、'));
      lines.push('　伏神规则：若用神不上卦，须取本宫伏神为用；伏神得日月生扶、或被本爻动爻引出方为"出伏有用"，否则伏而难用。');
    }

    var bt = bianYaoText(chart, mod, userText);
    if (bt) lines.push(bt);

    // 合 / 冲 / 刑 / 害 / 破 / 墓 / 空 + 三合三会 + 卦变 + 伏吟反吟 + 飞伏 + 神煞
    var rel = null;
    try { if (LY && LY.analyzeRelations) rel = LY.analyzeRelations(chart); } catch (e) { rel = null; }
    if (rel) {
      lines.push('【合冲刑害破·墓·空】');
      var any = false;
      rel.yao.forEach(function (o) {
        if (!o.tags.length) return;
        any = true;
        lines.push('  ' + o.posName + '：' + o.tags.join('；'));
      });
      if (!any) lines.push('  （各爻与日月、他爻均无合冲刑害破墓空）');
      if (rel.ju.length) {
        lines.push('【三合·半合·三会】' + rel.ju.map(function (j) {
          return j.type + '（' + j.zhi + '）·' + j.wx + '：' + j.note;
        }).join('；'));
        if (mod) {
          var ysJu = chart.ben.yaos.filter(function (a) { return a.liuqin === rUse; })[0];
          if (ysJu) {
            var hitJu = rel.ju.filter(function (j) { return j.type.indexOf('不成') < 0 && j.type.indexOf('半合') < 0 && j.zhi.indexOf(ysJu.zhi) >= 0; });
            if (hitJu.length) {
              lines.push('　★用神在局：用神' + ysJu.posName + ysJu.ganzhi + '（' + ysJu.liuqin + '）之支在' +
                hitJu[0].type + '（' + hitJu[0].zhi + '）内，其旺衰必须先按局论——若认局成，则不得沿用「用神休囚受损」类单爻结论；若认局不成，必须写明理由（局支空破等）。不得无视此局。');
            }
          }
        }
      }
      if (rel.anhe.length) lines.push('【暗合】' + rel.anhe.map(function (a) { return a.zhi; }).join('、') + '（主暗中勾连、隐蔽）');
      if (rel.gonghe.length) lines.push('【拱合】' + rel.gonghe.map(function (a) { return a.zhi + '：' + a.note; }).join('；'));
      lines.push('【卦变】' + rel.guaBian);
      if (rel.fuFan.length) lines.push('【伏吟反吟】' + rel.fuFan.join('；'));
      if (rel.feiFu.length) {
        lines.push('【飞伏】' + rel.feiFu.map(function (f) {
          return ['初', '二', '三', '四', '五', '上'][f.pos - 1] + '爻：伏神' + f.fu + '伏于飞神' + f.fei + '之下（' + f.rel + '）';
        }).join('；'));
        lines.push('　飞伏用法：用神不上卦时取伏神；飞神克伏则伏神难出，飞伏相冲或被日月冲动则冲开可出。');
      }
      lines.push('【神煞·仅辅助】驿马' + (rel.shensha.yiMa || '—') + '、桃花' + (rel.shensha.taoHua || '—') +
        '、天乙贵人' + ((rel.shensha.guiRen && rel.shensha.guiRen.join('/')) || '—') +
        '、羊刃' + (rel.shensha.yangRen || '—') + '（神煞只作辅助断事，不单独定吉凶）');
    }

    // 内外卦象意放在最后：仅作收尾补充印证，不作为断卦起点
    var TS = TRIGRAM_SEMANTIC[modId] || {};
    var upS = TS[chart.ben.upperKey], loS = TS[chart.ben.lowerKey];
    if (upS && loS) {
      lines.push('【内外卦象意·收口补充】外卦（外部环境与条件）' + chart.ben.upper.name + '：' + upS.core +
        '；内卦（自身内在实质）' + chart.ben.lower.name + '：' + loS.core +
        '。此象仅用于最后收尾时补充印证，不得作为断卦的出发点或结论依据。');
    }

    if (mod) {
      if (mod.dims && mod.dims.length) {
        lines.push('【本模块属性维度】' + mod.dims.join('、') + '（共' + mod.dims.length + '项）。第二阶段的「属性匹配表」必须逐项覆盖这些维度，不得增减、不得遗漏。');
      }
      var srcNote = '';
      if (mr && mr.source === '问句') srcNote = '（由求测者所问之事确定用神，非模块默认）';
      else if (mr && mr.source === '问句·近义') srcNote = '（问句未命中精确词表，经**近义词兜底**推得，置信度中等；须结合卦象与语境复核，勿据此强断）';
      else if (mr && mr.source === '世爻') srcNote = '（本占以世爻为纲，用神随问事与卦宫实算）';
      else if (mr && mr.source === '代占') srcNote = '（代占：所问之人非求测者自身，用神以对方六亲「' + mr.yongshen + '」为体，世爻退为求测人位）';
      else srcNote = '（本模块默认用神）';
      var confTxt = { high: '高', medium: '中', low: '低' }[mr && mr.confidence] || '';
      if (confTxt) srcNote += '【取用置信度：' + confTxt + '】';
      lines.push('【用神取用】' + mr.yongshen + '为用神' + srcNote +
        '，原神' + mr.yuanshen + '、忌神' + mr.jishen + '、仇神' + mr.choushen + '（原神/忌神/仇神随本卦卦宫五行实算）。');
      if (mr && mr.aux && mr.aux.length) {
        lines.push('【参看用神】' + mr.aux.map(function (a) { return a.lq + '（' + a.role + '）'; }).join('、') +
          '：为辅轴，与用神同看，不作单独吉凶主轴。');
      }
      if (mr && mr.ying) {
        lines.push('【第二轴】' + mr.ying + '：对方/外境，本占世应同看。');
      }
      if (mod.yongshenNote) lines.push('　取用说明：' + mod.yongshenNote);
      if (mod.shen && SHEN_DOMAIN[mod.shen]) {
        lines.push('【六神纲】本占属「' + mod.shen + '」：' + SHEN_DOMAIN[mod.shen].core + '。断卦侧重：' + SHEN_DOMAIN[mod.shen].lens);
      }
      if (mod.focus) lines.push('【本模块断卦要点】' + mod.focus);
      if (RISK_NOTE[mod.id]) lines.push('【本模块语气与风险约束】' + RISK_NOTE[mod.id]);
      lines.push('　分工：用神管吉凶成败与旺衰；世爻管"我"的状态；应爻管"它是什么、与合不合"。三者结论并列陈述，不互相推翻。');
      riyuePowerText(chart, mod, userText).forEach(function (l) { lines.push(l); });
      var mpt = modulePowerText(chart, mod, mr);
      if (mpt && mpt.length) {
        lines.push('【本模块力量侧重】（把上列逐爻力量落到本占焦点，供第二阶段直接采信）');
        mpt.forEach(function (l) { lines.push('  ' + l); });
      }
      if (mod.taxonomy) {
        lines.push('【' + mod.taxonomy.title + '】');
        mod.taxonomy.groups.forEach(function (g) {
          lines.push('  ' + g.cat + '：' + g.items.join('｜'));
        });
        lines.push('　第二阶段给出「属性匹配表 / 宜 / 忌 / 三忌」时，所有具体物类必须从上表选取并保留「分类标签」（如"蛋白质类·水产（鱼·虾·蟹·贝·其他水生）"）；禁止用"润养平补""适量""清淡"等虚词替代具体物类，虚词只能作为具体物类后的补充修饰。');
      }
    }
    return lines.join('\n');
  }

  // ==================== 离线结构化解析 ====================
  function offlineReading(modId, userText, chart) {
    var mod = MODULES[modId];
    var mr = modRoles(chart, mod, userText); // 原神/忌神/仇神随卦宫实算；用神由 resolveUseGod 动态解析
    var T = TRIGRAM_SEMANTIC[modId];
    var S = SHEN_SEMANTIC[modId];
    // 主气由太极点（世爻五行）推导，不再读取用户选择
    var yaos = chart.ben.yaos;
    var shiYao = yaos.filter(function (y) { return y.isShi; })[0];
    var yingYao = yaos.filter(function (y) { return y.isYing; })[0];
    var selfWx = shiYao ? shiYao.wuxing : '土';
    var mainWx = selfWx;
    var shen = shiYao ? shenText(modId, shiYao.liushen) : '';
    var ys = yaos.filter(function (y) { return y.liuqin === mr.yongshen; });
    var jsList = yaos.filter(function (y) { return y.liuqin === mr.jishen; });
    var csList = yaos.filter(function (y) { return y.liuqin === mr.choushen; });
    var ysYao = ys.filter(function (y) { return y.isShi; })[0] || ys.filter(function (y) { return y.isMoving; })[0] ||
      ys.slice().sort(function (a, b) { return b.wang.score - a.wang.score; })[0];
    // 用神旺衰决定“自身偏弱 / 偏强”，据此在离线方案中下调或上调强度
    var selfStrong = ysYao && ysYao.wang.score >= 2;
    var selfWeak = ysYao && ysYao.wang.score <= -1;

    // 主气（所选属性）对太极点的作用
    var rel = '同气', relDesc = '';
    if (mainWx === selfWx) { rel = '同气相求'; relDesc = '与你此刻的身体状态同频，能增益，但多了就是负担，宜守“七分”之界。'; }
    else if (WX_SHENG[mainWx] === selfWx) { rel = '生我（补益）'; relDesc = '所选属性是来生你的，属补益类，此刻身体受得住，可以放心取。'; }
    else if (WX_KE[mainWx] === selfWx) { rel = '克我（压力）'; relDesc = '所选属性克伐你的太极点，属压力类，此刻身体不太吃得消，宜减量或换个做法。'; }
    else if (WX_SHENG[selfWx] === mainWx) { rel = '我生（代谢消耗）'; relDesc = '你在为这件事付出，属代谢类，有消耗但可以带走积滞，别拖太久。'; }
    else { rel = '我克（耗散驾驭）'; relDesc = '你需要花力气去驾驭它，属消耗类，收益要靠足够的体力储备才换得来。'; }

    var sections = [];

    // 第一步
    sections.push({
      title: '第一步：信息校准与起卦背景',
      lines: [
        '求测事项：' + mod.name + '（' + mod.subtitle + '）',
        '求测者占问原文（务必紧扣此问题作答，严禁自行替换为模块默认问法）：' + askText(modId, userText),
        '太极点：以世爻（' + (shiYao ? shiYao.ganzhi + '，' + shiYao.liuqin : '—') + '）为你此刻的身心基准',
        '时空气场：' + chart.solarText + '，' + chart.lunarText + (chart.jieqi ? '（' + chart.jieqi + '）' : '') + '，月建' + chart.monthGanZhi + '，日辰' + chart.dayGanZhi,
        '所选之事的总体气性偏【' + mainWx + '】（' + rel + '）'
      ]
    });

    // 第二步
    var yongLine = [];
    if (ysYao) {
      var st = [];
      if (ysYao.isShi) st.push('用神持世，此事与你的状态贴身，影响直接');
      if (ysYao.isMoving) st.push('用神发动，事态有变数且能量正在释放');
      if (ysYao.isKong) st.push('用神旬空，眼前看着有机会实则落不实');
      if (ysYao.isYuePo) st.push('用神月破，本月力量受损，不宜强求');
      if (ysYao.isRiChong) st.push('日辰相冲，今日即有应象');
      yongLine.push('用神取【' + mr.yongshen + '】：落' + ysYao.posName + '，' + ysYao.ganzhi + '，' + ysYao.wuxing + '，配' + ysYao.liushen + '，于日月为「' + ysYao.wang.level + '」（' + (ysYao.wang.marks.join('、') || '无生克扶抑') + '）');
      yongLine.push('用神状态：' + (st.length ? st.join('；') : '安静无破，力量平顺，无外力拨转'));
    } else {
      yongLine.push('本卦中不见' + mr.yongshen + '爻，用神伏藏：所求之事暂时没有显化的着力点，宜守常、不必刻意强求。');
    }
    if (mr && mr.aux && mr.aux.length) {
      yongLine.push('参看用神：' + mr.aux.map(function (a) { return a.lq + '（' + a.role + '）'; }).join('、') + '（辅轴，与用神同看）。');
    }
    if (mr && mr.ying) {
      yongLine.push('第二轴：' + mr.ying + '（对方/外境，世应同看）。');
    }
    var shenLine = '六神提示：世爻临' + shiYao.liushen + '，' + shenText(modId, shiYao.liushen);
    sections.push({
      title: '第二步：装卦与特殊状态标记（京房纳甲）',
      lines: [
        '本卦：' + chart.ben.name + '（' + chart.ben.upper.name + '上' + chart.ben.lower.name + '下），' + chart.ben.info.palaceName + '属' + chart.ben.info.element + (chart.ben.info.tag ? '，' + chart.ben.info.tag : ''),
        '世在' + chart.ben.info.shi + '爻（' + shiYao.ganzhi + ' ' + shiYao.liuqin + '），应在' + chart.ben.info.ying + '爻（' + yingYao.ganzhi + ' ' + yingYao.liuqin + '）',
        '旬空：' + chart.xunkong.join('、') + '；月破：' + chart.yuepo + '；日辰相冲者有：' + (yaos.filter(function (y) { return y.isRiChong; }).map(function (y) { return y.posName; }).join('、') || '无')
      ].concat(yongLine, [shenLine])
    });

    // 第三步
    var lowerMeaning = T[chart.ben.lowerKey], upperMeaning = T[chart.ben.upperKey];
    var tensionLine = '';
    if (modId === 'diet') {
      tensionLine = '落到饮食：内卦（你吃进去的本质）' + lowerMeaning.like + '，' + lowerMeaning.advice + '；但' + lowerMeaning.risk + '。外卦（进食的场景与呈现）' + upperMeaning.like + '，' + upperMeaning.advice + '。';
    } else if (modId === 'sport') {
      tensionLine = '落到运动：体卦（你的身体动法）偏' + lowerMeaning.place + '一路，' + lowerMeaning.advice + '；' + lowerMeaning.risk + '。外卦（环境与场域）' + upperMeaning.place + '，' + upperMeaning.advice + '。';
    } else {
      tensionLine = '落到娱乐：内卦（你内在的真实需求）指向' + lowerMeaning.act + '，' + lowerMeaning.advice + '。外卦（外在可实现的形式）' + upperMeaning.act + '，' + upperMeaning.advice + '。';
    }

    var movingLine;
    if (chart.moving.length) {
      movingLine = '动爻拨转：' + chart.moving.map(function (m) {
        var b = chart.ben.yaos[m.index];
        var bb = chart.bian ? chart.bian.yaos[m.index] : null;
        return b.posName + '（' + b.ganzhi + ' ' + b.liuqin + '）动，化' + (bb ? bb.ganzhi + ' ' + bb.liuqin + ' ' + bb.wuxing : '—') + '，' +
          (WX_SHENG[bb ? bb.wuxing : ''] === b.wuxing ? '化回头生，先难后顺' :
            (WX_KE[bb ? bb.wuxing : ''] === b.wuxing ? '化回头克，中途易折，宜见好就收' :
              (bb && b.wuxing === bb.wuxing ? '化同类，力量延续但不变' : '化出异气，结果会偏离预期')));
      }).join('；') + '。野鹤老人重看动爻，此爻即是你这次选择的“变数点”。';
    } else {
      movingLine = '六爻安静无动：野鹤老人云“静爻力量轻而缓”，此局没有突发转折，结果是渐进的，成败取决于你的执行而非外力。';
    }

    sections.push({
      title: '第三步：核心格局分析（用神·原忌神）',
      lines: [
        '用神' + mr.yongshen + '（' + (ysYao ? ysYao.wuxing : '—') + '）与太极点（' + selfWx + '）：' + rel + '，' + relDesc,
        '原神' + mr.yuanshen + '：' + (yaos.filter(function (y) { return y.liuqin === mr.yuanshen; }).map(function (y) { return y.posName + y.ganzhi + '（' + y.wang.level + '）'; }).join('、') || '本卦不显，助力不足，需人为补足'),
        '忌神' + mr.jishen + '：' + (jsList.length ? jsList.map(function (y) { return y.posName + y.ganzhi + (y.isMoving ? '（发动，克用有力）' : '（安静，暂未逞凶）'); }).join('、') : '本卦不显，暂无克制之忧'),
        '仇神' + mr.choushen + '：' + (csList.length ? csList.map(function (y) { return y.posName + y.ganzhi; }).join('、') + '（生助忌神，间接耗力）' : '本卦不显'),
        tensionLine,
        movingLine
      ]
    });

    // 第四步
    var timeLines = [];
    if (ysYao && ysYao.isKong) {
      var da = Math.min(daysToZhi(chart.dayZhi, chart.xunkong[0]), daysToZhi(chart.dayZhi, chart.xunkong[1]));
      timeLines.push('用神空亡，古法云“空亡出空而应”，约 ' + da + ' 天后（' + chart.xunkong.join('或') + '日）见到实效，这几天先别急着加码');
    } else if (ysYao && ysYao.isYuePo) {
      timeLines.push('用神月破，“破待合而补”，本月内宜守不攻，下个节气（换月建）后再行加量');
    } else if (ysYao && ysYao.isRiChong) {
      timeLines.push('用神逢日辰冲动，“旺相逢冲即应”，今日就有反馈，留意身体的即时反应');
    } else {
      timeLines.push('用神无空破、无冲克，“休囚待生旺”，趋势平顺，按部就班即可，见效偏慢但稳');
    }
    if (ysYao && ysYao.wang.score >= 2) timeLines.push('用神得日月生扶而旺，力度到位，可以适当超过常规强度 10%-15%');
    else if (ysYao && ysYao.wang.score <= -1) timeLines.push('用神休囚，建议把计划打个八折，宁可少做也别勉强');

    var action = [];
    if (modId === 'diet') {
      action.push('颜色搭配：偏' + selfWx + '，宜用' + ({ 木: '青绿（入肝）', 火: '红赤（入心）', 土: '黄橙（入脾）', 金: '白（入肺）', 水: '黑紫（入肾）' }[selfWx]) + '为主色，另搭一味相生色平衡');
      action.push('烹饪法：' + (selfWx === '水' ? '温煮佐姜，忌生冷' : (selfWeak ? '蒸煮温软，少炒炸' : '以蒸煮炖为主，可少量快炒')));
      action.push('分量：' + (selfWeak ? '七分以下、吃到不饿即止' : '七分平，维持即可'));
    } else if (modId === 'sport') {
      action.push('场地：' + upperMeaning.place + '与本次卦象相合，优先选它；次选' + T[chart.bian ? chart.bian.upperKey : 'kun'].place);
      action.push('强度：卦象提示' + (selfWeak ? '下调一档，以心率能说话为界' : '可维持，最后一组别冲力竭'));
      action.push('节奏：先' + T[chart.bian ? chart.bian.lowerKey : 'gen'].place.replace(/、.*/, '') + '热身 8 分钟，主项完成后用 5 分钟慢收，不要骤停');
    } else {
      action.push('形式：优先' + upperMeaning.act + '，它对应你此刻的外卦场域，最容易有回响');
      action.push('对象：世临' + shiYao.liushen + '（' + shen + '），' + (shen.indexOf('新鲜') >= 0 || shen.indexOf('变换') >= 0 ? '可以多换几家朋友、多换几个场景' : '人数不必多，两三人即可，人多反而散神'));
      action.push('时长：' + (selfWeak ? '留出最后 10 分钟给自己收尾（写几句话或静坐），别尽兴到透支' : '可以尽兴，但结束前留一句复盘'));
    }

    sections.push({
      title: '第四步：趋势推断与应期参考',
      lines: [
        '趋断：' + (ysYao && ysYao.wang.score >= 2 ? '用神旺相，此事可成，且有超出预期的余量。' : (ysYao && ysYao.wang.score <= -1 ? '用神休囚，当下不宜强求，退一步反而得。' : '吉凶未分，格局平稳，结果主要握在你自己手上。')) +
          (chart.moving.length ? '卦有' + chart.moving.length + '个动爻，过程必有变化，别执着于既定计划。' : '静卦主缓，不会有大起大落。')
      ].concat(timeLines, ['可执行三条：'], action.map(function (a, i) { return '  ' + (i + 1) + '. ' + a; }))
    });

    // 第五步
    sections.push({
      title: '第五步：哲思启发与现实建议',
      lines: [
        '《易》曰“穷则变，变则通”。此卦处在' + (chart.ben.info.tag || bookOrder(chart.ben.info.order)) + '之位，说的是' + phaseAdvice(chart.ben.info.order, chart.moving.length) + '。',
        '从荣格的共时性看，你在' + chart.solarText + '这一刻摇出' + chart.ben.name + '，更像是一次与自身状态的照面：卦不替你做决定，它只是把你心里隐约知道的东西摆到台面上。',
        '避忌提醒：' + (modId === 'diet' ? lowerMeaning.risk + '；' + upperMeaning.risk : (modId === 'sport' ? lowerMeaning.risk + '；' + upperMeaning.risk : '别把它当成任务来完成，一旦开始计较“值不值”“够不够好”，收益就打折了。')),
        '理性提示：六爻是古人处理不确定性的决策辅助工具，不是宿命判决。本解析基于《卜筮正宗》与《增删卜易》的理法推演，供你参考适合自己的选择；涉及疾病、体重、伤痛或财务医疗决策，请务必咨询医生与专业机构。'
      ]
    });

    return sections;
  }

  function bookOrder(n) {
    return ['本宫正位', '一世之变', '二世之进', '三世之滞', '四世之升', '五世之极', '游魂不定', '归魂返本'][n - 1] || '中正';
  }
  function phaseAdvice(order, movingCount) {
    var base = {
      1: '守正即可，不必外求',
      2: '变化才起，宜轻试不宜重仓',
      3: '渐有其形，可加一点力度',
      4: '进退之间，宜稳不宜急',
      5: '已有小成，注意别散',
      6: '势已到顶，适可而止最好',
      7: '心在外而身未定，先把当下的事做完',
      8: '返本归位，回到最简单那一步反而有效'
    }[order] || '顺势而行';
    return base + (movingCount >= 3 ? '。卦中动爻多，外部环境摇摆，你的计划要留出改的余地' : (movingCount === 0 ? '。卦静无变，稳住节奏比什么都重要' : ''));
  }

  // ==================== 智能体请求构造（两段串接） ====================
  // 第一阶段：六爻助手依据排盘做出「卦象总断」，不含模块落地建议
  function buildStage1Messages(modId, userText, chart) {
    var mod = MODULES[modId];
    var system = P.LIUYAO_BASE + P.STAGE1_RULES;
    if (SYM && SYM.stage1Anchor) system += '\n' + SYM.stage1Anchor(chart, modId, userText) + '\n';
    var user = [
      '请按 SOP 为下面这次起卦做出「卦象总断」。',
      '',
      '## 一、求测背景',
      '求测类别：' + mod.name + '（' + mod.subtitle + '）',
      '太极点说明：' + mod.desc,
      '求测者占问原文（这是用户本卦具体要问的问题，必须紧扣它作答；它只决定「问什么」，不替代卦象的用神与旺衰推导；模块角色仅提供六亲取象框架，严禁把问题替换成本模块默认问法）：' + askText(modId, userText),
      '',
      '## 二、卦象数据（已按京房纳甲完成装卦，请直接采信，不要重新起卦）',
      chartText(chart, mod, userText),
      '',
      '请开始五步输出，产出卦象总断。'
    ].join('\n');
    return [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];
  }

  // 第二阶段：模块专属角色，在第一阶段结论之上、由卦象自行推导属性，深化为落地方案
  function buildStage2Messages(modId, userText, chart, stage1Text, opts) {
    var mod = MODULES[modId];
    var system = P.get(modId);
    if (mod.shen && SHEN_DOMAIN[mod.shen]) system += '\n# 本占六神纲（' + mod.shen + '）\n' +
      SHEN_DOMAIN[mod.shen].core + '\n' + SHEN_DOMAIN[mod.shen].lens + '\n';
    if (mod.focus) system += '\n# 本模块断卦要点（检索用，直接采信）\n- ' + mod.focus + '\n';
    if (RISK_NOTE[modId]) system += '\n# 本模块语气与风险约束（必须遵守）\n- ' + RISK_NOTE[modId] + '\n';
    // 数据驱动：按本卦实况从词表选取联想约束注入（整体铁律+局部触发+模块取象锚点）
    // opts.axisLock=false 时不注入轴锁块（仅供消融实验）
    if (SYM && SYM.selectSymbols) system += '\n' + SYM.selectSymbols(chart, modId, Object.assign({}, opts || {}, { userText: userText })) + '\n';
    system += P.STAGE2_RULES;
    var user1 = [
      '请你作为本次的专项顾问，下面给你三样东西：起卦的原始盘面、求测者自述（选填）、以及六爻助手已经完成的卦象总断。',
      '',
      '## 一、起卦背景',
      '求测类别：' + mod.name + '（' + mod.subtitle + '）',
      '求测者占问原文（务必紧扣此问题作答，严禁自行替换为模块默认问法）：' + askText(modId, userText),
      '',
      '## 二、原始卦象数据（供你核对，不要重新起卦）',
      chartText(chart, mod, userText)
    ].join('\n');
    var user2 = [
      '## 三、六爻助手的卦象总断（你必须直接采信，不可推翻其用神与旺衰结论）',
      '---------- 总断开始 ----------',
      (stage1Text || '').trim(),
      '---------- 总断结束 ----------',
      '',
      (mod.dims && mod.dims.length
        ? '请以上述卦象总断为依据，严格按你自己的角色设定与 SOP「第一步到第五步」，先输出「属性匹配表」再输出落地方案。属性必须由卦象推导，不得要求求测者补充选择。'
        : '请以上述卦象总断为依据，按你自己的角色设定与 SOP 输出：先复述问题并给一句话正面回答（成败＋应期），再输出「关键依据表」（用神/忌神/世应/动爻 → 爻位与旺衰依据 → 结论），最后给过程阻碍分析、应期推断、风险提示与三条可执行行动建议。不得要求求测者补充选择。')
    ].join('\n');
    return [
      { role: 'system', content: system },
      { role: 'user', content: user1 },
      { role: 'assistant', content: (stage1Text || '').trim() },
      { role: 'user', content: user2 }
    ];
  }

  // ==================== 轴锁：校验 + 重试（替代降温度的机械方案）====================
  /**
   * 校验一次 Stage2 产出的用神轴是否与引擎锚句一致。
   * @returns {{ok:boolean, reason:string, attempt:number, anchor:string|null}}
   */
  function checkAxis(modId, chart, text, attempt, userText) {
    if (!SYM || !SYM.verifyAxis) return { ok: true, reason: 'no-verifier', attempt: attempt || 1, anchor: null };
    var r = SYM.verifyAxis(chart, modId, text, userText);
    return { ok: !!r.ok, reason: r.reason, attempt: attempt || 1, anchor: (r.anchor || null), found: r.found || null };
  }

  /**
   * 带轴锁的 Stage2 调用：轴反置则重试一次（第二次带更强的纠正指令），仍错则降级并标记。
   * @param callFn (messages, onDelta) => Promise<string>   —— 实际的 LLM 调用由调用方注入
   * @param opts  { modId, userText, chart, stage1Text, onDelta, onRetry, maxRetry }
   * @returns Promise<{ text, axisOk, attempts, axisReason, anchor }>
   */
  function runStage2Guarded(callFn, opts) {
    var modId = opts.modId, chart = opts.chart, stage1 = opts.stage1Text || '';
    var maxRetry = (typeof opts.maxRetry === 'number') ? opts.maxRetry : 1;
    var attempt = 0;
    var anchorObj = (SYM && SYM.axisAnchor) ? SYM.axisAnchor(chart, modId, opts.userText) : null;
    var anchor = anchorObj ? anchorObj.anchor : '';

    function once(isRetry) {
      attempt++;
      var msgs = buildStage2Messages(modId, opts.userText, chart, stage1);
      if (isRetry && anchor) {
        // 第二次：把纠正指令直接写进对话，明确指出上一轮错在哪
        msgs = msgs.concat([{
          role: 'user',
          content: '【系统校验未通过 · 硬错纠正】你上一轮的用神轴与系统判定不一致，本轮必须纠正后重写全文。\n'
            + '系统唯一认定的轴（这一行必须一字不改地出现在你回答的第一句）：\n' + anchor + '\n'
            + '严禁另立用神主轴、严禁把原神或忌神当成用神。若你认为系统判定有误，仍须先原样写出该行，'
            + '再在正文中另起一段说明你的理由（不得改动第一行）。'
        }]);
      }
      return Promise.resolve(callFn(msgs, opts.onDelta));
    }

    return once(false).then(function (t1out) {
      var c1 = checkAxis(modId, chart, t1out, 1, opts.userText);
      if (c1.ok || maxRetry < 1) {
        return { text: t1out, axisOk: c1.ok, attempts: 1, axisReason: c1.reason, anchor: c1.anchor || anchor };
      }
      if (opts.onRetry) opts.onRetry(c1);
      return once(true).then(function (t2out) {
        var c2 = checkAxis(modId, chart, t2out, 2, opts.userText);
        if (!c2.ok) {
          // 两次都错：降级——保留产出但显式标注轴未通过校验（不静默蒙混）
          var tag = '\n\n---\n【系统提示】本次用神轴未通过机械校验（' + c2.reason + '）。'
            + '以上内容由模型生成，可能存在用神取错，请以系统锚定的「' + (c2.anchor || anchor) + '」为准。';
          t2out = t2out + tag;
        }
        return { text: t2out, axisOk: c2.ok, attempts: 2, axisReason: c2.reason, anchor: c2.anchor || anchor };
      });
    }).catch(function (e) {
      return { text: '', axisOk: false, attempts: attempt, axisReason: '调用异常：' + (e && e.message ? e.message : String(e)), anchor: anchor, error: e };
    });
  }

  // 领域错配提示（供 UI 与 Stage2 使用）
  function domainNotice(modId, userText) {
    if (!SYM || !SYM.domainGate) return { neutral: false, note: '' };
    return SYM.domainGate(modId, userText);
  }

  function buildAgentMessages(modId, userText, chart) {
    return buildStage1Messages(modId, userText, chart);
  }

  return {
    MODULES: MODULES,
    SHEN_DOMAIN: SHEN_DOMAIN,
    SHEN_QA: SHEN_QA,
    LIUQIN_QA: LIUQIN_QA,
    RISK_NOTE: RISK_NOTE,
    MOD_GROUPS: MOD_GROUPS,
    TRIGRAM_SEMANTIC: TRIGRAM_SEMANTIC,
    SHEN_SEMANTIC: SHEN_SEMANTIC,
    LIUQIN_SEMANTIC: LIUQIN_SEMANTIC,
    LIUQIN_CLASSIC: LIUQIN_CLASSIC,
    shenText: shenText, liuqinText: liuqinText,
    yaoXiangText: yaoXiangText, yaoStateText: yaoStateText, shengkeText: shengkeText,
    huaRelation: huaRelation, csStageOf: csStageOf, bianYaoText: bianYaoText,
    HUA_JIN: HUA_JIN, HUA_TUI: HUA_TUI,
    findModule: findModule,
    situationText: situationText,
    ASK_DEFAULT: ASK_DEFAULT,
    askText: askText,
    askPlaceholder: askPlaceholder,
    chartText: chartText,
    offlineReading: offlineReading,
    buildAgentMessages: buildAgentMessages,
    buildStage1Messages: buildStage1Messages,
    buildStage2Messages: buildStage2Messages,
    checkAxis: checkAxis,
    runStage2Guarded: runStage2Guarded,
    domainNotice: domainNotice,
    daysToZhi: daysToZhi
  };
});
