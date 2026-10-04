
(function () {
  var LY = window.LiuYao, CFG = window.AppConfig;
  var $ = function (s) { return document.querySelector(s); };
  var posName = ['初', '二', '三', '四', '五', '上'];

  var state = {
    moduleId: null,
    text: '',
    chart: null,
    aiFinal: '',
    aiStage1: '',
    tossing: false,
    raw: []
  };

  // ---------- 干支（节气月建 / 日辰） ----------
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function beijingTime(d) {
    d = d || new Date();
    var bj = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60000);
    return bj.getFullYear() + '-' + pad2(bj.getMonth() + 1) + '-' + pad2(bj.getDate()) +
      ' ' + pad2(bj.getHours()) + ':' + pad2(bj.getMinutes()) + ' 北京时间';
  }
  function nowGanzhi(d) {
    d = d || new Date();
    var lunar = window.Lunar.fromDate(d);
    var ec = lunar.getEightChar();
    var jqTable = { 立春: '寅', 雨水: '寅', 惊蛰: '卯', 春分: '卯', 清明: '辰', 谷雨: '辰', 立夏: '巳', 小满: '巳', 芒种: '午', 夏至: '午', 小暑: '未', 大暑: '未', 立秋: '申', 处暑: '申', 白露: '酉', 秋分: '酉', 寒露: '戌', 霜降: '戌', 立冬: '亥', 小雪: '亥', 大雪: '子', 冬至: '子', 小寒: '丑', 大寒: '丑' };
    var prev = lunar.getPrevJieQi(), next = lunar.getNextJieQi();
    return {
      month: ec.getMonth(),
      day: ec.getDay(),
      jieqi: prev ? prev.getName() : '',
      nextJieqi: next ? next.getName() : '',
      solarText: d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日',
      lunarText: lunar.getMonthInChinese() + '月' + lunar.getDayInChinese(),
      beijing: beijingTime(d),
      ganzhiYear: lunar.getYearInGanZhi()
    };
  }

  // ---------- 通用 ----------
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }
  function switchView(id) {
    ['home', 'div', 'res', 'set'].forEach(function (v) {
      $('#view-' + v).classList.toggle('hide', v !== id);
    });
    window.scrollTo(0, 0);
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  // ---------- 首页模块列表 ----------
  function renderHome() {
    var g = nowGanzhi();
    $('#heroGz').textContent = g.ganzhiYear + '年 · 月建' + g.month + ' · 日辰' + g.day + ' · ' + g.jieqi;
    var html = '';
    ['diet', 'sport', 'fun'].forEach(function (id) {
      var m = CFG.MODULES[id];
      html += '<div class="mod-card" data-mod="' + id + '" style="--mc:' + m.color + ';--mc2:' + m.color2 + '">' +
        '<div class="mod-icon">' + m.icon + '</div>' +
        '<div class="mod-body"><div class="mod-name">' + m.name + '</div>' +
        '<div class="mod-sub">' + m.subtitle + '</div>' +
        '<div class="mod-desc">' + m.desc + '</div></div>' +
        '<div class="mod-arrow">›</div></div>';
    });
    $('#modList').innerHTML = html;
    renderHistory();
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem('wy_records') || '[]'); } catch (e) { return []; }
  }
  function saveRecord(rec) {
    var list = getHistory(); list.unshift(rec);
    if (list.length > 20) list = list.slice(0, 20);
    localStorage.setItem('wy_records', JSON.stringify(list));
  }
  function recFigHTML(six) {
    if (!six) return '';
    return '<div class="rec-fig">' + six.slice().reverse().map(function (b) {
      return '<i class="rec-ln ' + (b ? 'y' : 'n') + '"></i>';
    }).join('') + '</div>';
  }
  function renderHistory() {
    var list = getHistory();
    var box = $('#historyBox');
    var mods = ['diet', 'sport', 'fun'];
    if (!list.length) { box.innerHTML = '<div class="empty">还没有保存的记录，起卦后点「保存此卦」即可存入对应分组</div>'; return; }
    box.innerHTML = mods.map(function (id) {
      var m = CFG.MODULES[id];
      var recs = [];
      list.forEach(function (r, i) { if (r.moduleId === id) recs.push({ r: r, i: i }); });
      if (!recs.length) return '<div class="grp"><div class="grp-h"><span class="gi">' + m.icon + '</span>' + m.name + '记录<span class="gc">0</span></div><div class="empty">暂无</div></div>';
      var rows = recs.map(function (o) {
        var r = o.r;
        // 阳历日期 + 北京时间（不含星期）
        var bj = r.beijing || '';
        var bm = bj.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/);
        var solarRaw = r.solar ? String(r.solar).replace(/^公历\s*/, '') : '';
        var solarTxt = solarRaw || (bm ? (bm[1] + '-' + bm[2] + '-' + bm[3]) : '');
        var bjTxt = bm ? (bm[4] + ' 北京时间') : (bj || '');
        return '<div class="rec-row" data-rec="' + o.i + '">' + recFigHTML(r.six || (r.chart && r.chart.ben && r.chart.ben.six)) +
          '<div class="rec-mid"><b class="rg">' + esc(r.gua) + (r.aiFinal ? '<i class="tag-ai">已存解读</i>' : '') + '</b><span class="ra">' + esc(r.text || '（未填写）') + '</span></div>' +
          '<div class="rt"><span class="rt-s">阳历 ' + esc(solarTxt) + '</span><span class="rt-b">' + esc(bjTxt) + '</span></div>' +
          '<i class="rec-del" data-del="' + o.i + '">✕</i></div>';
      }).join('');
      return '<div class="grp" style="--mc:' + m.color + '"><div class="grp-h"><span class="gi">' + m.icon + '</span>' + m.name + '记录<span class="gc">' + recs.length + '</span></div><div class="grp-list">' + rows + '</div></div>';
    }).join('');
  }
  function doSave() {
    if (!state.chart) return;
    var m = CFG.MODULES[state.moduleId];
    saveRecord({
      id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      moduleId: state.moduleId, modName: m.name, text: state.text || '',
      gua: state.chart.ben.name + (state.chart.bian ? ' 之 ' + state.chart.bian.name : ''),
      six: state.chart.ben.six, solar: state.chart.solarText, beijing: state.beijing || beijingTime(),
      chart: state.chart, raw: state.raw,
      aiFinal: state.aiFinal || '', aiStage1: state.aiStage1 || '', createdAt: Date.now()
    });
    toast('已存入「' + m.name + '」记录');
    var b = $('#btnSave'); if (b) { b.textContent = '已保存 ✓'; b.disabled = true; }
    renderHistory();
  }

  $('#historyBox').addEventListener('click', function (e) {
    var del = e.target.closest('.rec-del');
    if (del) {
      var di = +del.dataset.del;
      var list = getHistory(); list.splice(di, 1);
      localStorage.setItem('wy_records', JSON.stringify(list)); renderHistory(); toast('已删除');
      return;
    }
    var row = e.target.closest('.rec-row'); if (!row) return;
    var rec = getHistory()[+row.dataset.rec]; if (!rec) return;
    state.moduleId = rec.moduleId; state.text = rec.text || ''; state.chart = rec.chart; state.beijing = rec.beijing;
    // 记录里若已存过解读，直接复用，避免重复调用大模型
    state.aiFinal = rec.aiFinal || ''; state.aiStage1 = rec.aiStage1 || '';
    renderDivination();
    if (rec.raw) {
      state.raw = rec.raw; drawDots(rec.raw);
      $('#tossTip').textContent = '成卦：' + state.chart.ben.name;
    }
    renderChart(state.chart);
    switchView('div');
  });
  $('#clearHistory').addEventListener('click', function () {
    if (!confirm('确定清空全部记录？')) return;
    localStorage.removeItem('wy_records'); renderHistory(); toast('已清空');
  });
  $('#resBox').addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnSave') doSave();
  });

  // ---------- 进入起卦页 ----------
  $('#modList').addEventListener('click', function (e) {
    var c = e.target.closest('.mod-card'); if (!c) return;
    enterModule(c.dataset.mod);
  });
  function enterModule(id) {
    state.moduleId = id; state.text = ''; state.chart = null; state.raw = [];
    renderDivination();
    switchView('div');
  }

  function renderDivination() {
    if (!state.moduleId) return;
    var m = CFG.MODULES[state.moduleId];
    $('#divTitle').textContent = m.name;
    var html = '<div class="mod-head" style="--mc:' + m.color + '">' + m.icon + ' ' + m.name +
      '<div class="mod-head-sub">' + m.subtitle + '</div></div>';
    html += '<div class="card qa">' +
      '<div class="q-title">这一卦你想问的具体心事（选填）</div>' +
      '<textarea id="askText" class="ask-text" placeholder="例如：最近脾胃偏弱想调理；或：压力大想找个放松的方式。留空则完全以卦象为准。">' + esc(state.text) + '</textarea>' +
      '<div class="q-hint">属性不再由你勾选，将由卦象总断推导后，由模块顾问匹配给出建议。</div>' +
      '</div>';
    $('#qaBox').innerHTML = html;
    var ta = $('#askText');
    if (ta) { ta.addEventListener('input', function () { state.text = ta.value; }); }

    // 重置摇卦区
    state.raw = [];
    $('#yaoDots').querySelectorAll('i').forEach(function (i) { i.className = ''; });
    $('#tossTip').textContent = '心念既定，摇钱起卦';
    $('#chartBox').classList.add('hide');
    $('#chartBox').innerHTML = '';
  }

    // 属性不再由用户勾选：无选项点击逻辑

  $('#divReset').addEventListener('click', function () {
    state.raw = []; state.chart = null;
    $('#chartBox').classList.add('hide'); $('#chartBox').innerHTML = '';
    $('#yaoDots').querySelectorAll('i').forEach(function (i) { i.className = ''; });
    $('#tossTip').textContent = '心念既定，摇钱起卦';
  });

  // ---------- 摇卦动画 ----------
  var COIN_TEXT = { 2: '字', 3: '背' };
  function shakeCoins(cb) {
    var coins = $('#coinRow').querySelectorAll('.coin');
    coins.forEach(function (c) { c.classList.add('rolling'); });
    var r = LY.tossOnce();
    setTimeout(function () {
      coins.forEach(function (c, i) {
        c.classList.remove('rolling');
        var back = r.coins[i] === 3;
        c.classList.toggle('back', back);
        c.querySelector('span').textContent = COIN_TEXT[r.coins[i]];
      });
      cb(r);
    }, 620);
  }
  function drawDots(raw) {
    var dots = $('#yaoDots').querySelectorAll('i');
    dots.forEach(function (d, i) {
      d.className = raw[i] ? (raw[i].sum === 9 ? 'yang mv' : (raw[i].sum === 7 ? 'yang' : (raw[i].sum === 6 ? 'yin mv' : 'yin'))) : '';
    });
  }
  $('#btnToss').addEventListener('click', function () {
    if (state.tossing) return;
    var m = CFG.MODULES[state.moduleId];
    state.tossing = true; state.raw = [];
    $('#chartBox').classList.add('hide');
    $('#yaoDots').querySelectorAll('i').forEach(function (i) { i.className = ''; });
    var step = 0;
    (function next() {
      if (step >= 6) {
        state.tossing = false;
        var g = nowGanzhi();
        state.chart = LY.arrange({
          monthGanZhi: g.month, dayGanZhi: g.day, jieqi: g.jieqi,
          solarText: '公历 ' + g.solarText, lunarText: '农历' + g.lunarText,
          six: state.raw
        });
        state.beijing = g.beijing;
        renderChart(state.chart);
        $('#tossTip').textContent = '成卦：' + state.chart.ben.name;
        return;
      }
      $('#tossTip').textContent = '正在摇第 ' + (step + 1) + ' 爻…';
      shakeCoins(function (r) {
        state.raw.push(r);
        drawDots(state.raw);
        step++;
        setTimeout(next, 260);
      });
    })();
  });

  // ---------- 排盘渲染 ----------
  function yaoLinesHTML(yaos, withShen) {
    return yaos.slice().reverse().map(function (y) {
      return '<div class="yr' + (y.isMoving ? ' mv' : '') + '">' +
        (withShen ? '<span class="c-shen">' + y.liushen + '</span>' : '<span class="c-shen dim">·</span>') +
        '<span class="c-sym">' + (y.yang ? '<i class="ln yang' + (y.isMoving ? ' m' : '') + '"></i>' : '<i class="ln yin' + (y.isMoving ? ' m' : '') + '"></i><i class="ln yin' + (y.isMoving ? ' m' : '') + '"></i>') + '</span>' +
        '<span class="c-tag">' + (y.isMoving ? y.mark : (y.shiTag || '')) + '</span>' +
        '<span class="c-lq ' + lqClass(y.liuqin) + '">' + y.liuqin + '</span>' +
        '<span class="c-gz">' + y.ganzhi + '</span>' +
        '<span class="c-wx wx-' + y.wuxing + '">' + y.wuxing + '</span>' +
        '<span class="c-flag">' + flagText(y) + '</span>' +
        '</div>';
    }).join('');
  }
  // 对照表单元（本卦 / 变卦 各一列）
  function yaoCellHTML(y) {
    return '<div class="c-b' + (y.isMoving ? ' mv' : '') + '">' +
      '<span class="c-sym">' + (y.yang ? '<i class="ln yang' + (y.isMoving ? ' m' : '') + '"></i>' : '<i class="ln yin' + (y.isMoving ? ' m' : '') + '"></i><i class="ln yin' + (y.isMoving ? ' m' : '') + '"></i>') + '</span>' +
      '<span class="c-tag">' + (y.isMoving ? y.mark : (y.shiTag || '')) + '</span>' +
      '<span class="c-lq ' + lqClass(y.liuqin) + '">' + y.liuqin + '</span>' +
      '<span class="c-gz">' + y.ganzhi + '</span>' +
      '<span class="c-cs">' + (y.changsheng || '') + '</span>' +
      '</div>';
  }
  function lqClass(lq) {
    return { 父母: 'lq-p', 官鬼: 'lq-g', 妻财: 'lq-c', 子孙: 'lq-z', 兄弟: 'lq-b' }[lq] || '';
  }
  function flagText(y) {
    var f = [];
    if (y.isKong) f.push('空');
    if (y.isYuePo) f.push('破');
    if (y.isMoving) f.push(y.old === '阳' ? '阳动' : '阴动');
    if (y.wang.level === '旺') f.push('旺');
    if (y.wang.level === '衰极') f.push('衰');
    return f.join(' ');
  }
  function guaFigureHTML(gua) {
    return '<div class="fig">' + gua.six.slice().reverse().map(function (b, i) {
      var idx = 5 - i;
      var mv = gua.__moving && gua.__moving.indexOf(idx) >= 0;
      return b ? '<i class="ln yang' + (mv ? ' m' : '') + '"></i>' : '<i class="ln yin' + (mv ? ' m' : '') + '"></i><i class="ln yin' + (mv ? ' m' : '') + '"></i>';
    }).join('<br>') + '</div>';
  }

  function renderChart(chart) {
    var mvIdx = chart.moving.map(function (m) { return m.index; });
    chart.ben.__moving = mvIdx;
    if (chart.bian) chart.bian.__moving = mvIdx;
    var m = CFG.MODULES[state.moduleId];
    var html = '';

    html += '<div class="plate">';
    html += '<div class="plate-head"><span class="pt">本卦</span><span class="pg">' + chart.ben.name + '</span>' +
      '<span class="pm">' + chart.ben.info.palaceName + '·' + chart.ben.info.element + (chart.ben.info.tag ? '·' + chart.ben.info.tag : '') + '</span></div>';
    html += '<div class="figs">' + guaFigureHTML(chart.ben) +
      (chart.bian ? '<div class="fig-arrow">之</div>' + guaFigureHTML(chart.bian) + '<div class="fig-label">' + chart.bian.name + '</div>' : '<div class="fig-label">静卦</div>') + '</div>';
    html += '<div class="meta">' + esc(chart.solarText) + '　' + esc(chart.lunarText) +
      '<br>月建 <b>' + chart.monthGanZhi + '</b>　日辰 <b>' + chart.dayGanZhi + '</b>　旬空 <b>' + chart.xunkong.join('、') + '</b>　月破 <b>' + chart.yuepo + '</b>' +
      (chart.jieqi ? '<br>节气 ' + chart.jieqi : '') + '</div>';
    html += '<div class="yongshen">用神 <b>' + m.yongshen + '</b>　原神 <b>' + m.yuanshen + '</b>　忌神 <b>' + m.jishen + '</b>　仇神 <b>' + m.choushen + '</b></div>';
    // 本卦 / 变卦 左右对照
    var bianRev = chart.bian ? chart.bian.yaos.slice().reverse() : null;
    var cmp = '<div class="cmp"><div class="cmp-row cmp-head"><span class="c-shen">六神</span>' +
      '<span class="c-cap">本卦 · ' + chart.ben.name + '</span>' +
      (chart.bian ? '<span class="c-cap">变卦 · ' + chart.bian.name + '</span>' : '<span class="c-cap">静卦</span>') + '</div>';
    chart.ben.yaos.slice().reverse().forEach(function (y, i) {
      var by = bianRev ? bianRev[i] : null;
      cmp += '<div class="cmp-row' + (y.isMoving ? ' mv' : '') + '">' +
        '<span class="c-shen">' + y.liushen + '</span>' +
        yaoCellHTML(y) +
        (by ? yaoCellHTML(by) : '<div class="c-b c-static">—</div>') + '</div>';
    });
    cmp += '</div>';
    html += cmp;
    // 伏神
    if (chart.ben.fu && chart.ben.fu.length) {
      var fuRev = chart.ben.fu.slice().reverse();
      html += '<div class="fu"><div class="fu-h">伏神（本宫 · ' + chart.ben.info.palaceName + '）</div>' +
        fuRev.map(function (f) {
          return '<div class="fu-row"><span class="c-lq ' + lqClass(f.liuqin) + '">' + f.liuqin + '</span>' +
            '<span class="c-gz">' + f.ganzhi + '</span>' +
            '<span class="c-tag">' + ['初', '二', '三', '四', '五', '上'][f.pos - 1] + '爻</span></div>';
        }).join('') + '</div>';
    }
    html += '</div>';

    html += '<button class="btn-main big" id="btnAi">AI 智能体解析</button>';
    html += '<div class="sub-tip">两段串接：① 六爻助手做卦象总断　② ' + m.name + '顾问做落地方案</div>';

    $('#chartBox').innerHTML = html;
    $('#chartBox').classList.remove('hide');
    $('#btnAi').addEventListener('click', function () {
      state.aiFinal = ''; state.aiStage1 = '';
      switchView('res');
      renderResult();
      if (hasKey()) runTwoStage();
    });
    $('#chartBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- 解析结果（两段串接） ----------
  function ctxCard() {
    var m = CFG.MODULES[state.moduleId], c = state.chart;
    return '<div class="card ask">' +
      '<div class="ask-line"><span class="k">事项</span>' + m.icon + ' ' + m.name + '</div>' +
      '<div class="ask-line"><span class="k">问事</span>' + esc(CFG.situationText(state.text)) + '</div>' +
      '<div class="ask-line"><span class="k">卦象</span>' + c.ben.name + (c.bian ? ' 之 ' + c.bian.name : '') +
      '　世' + c.ben.info.shi + '应' + c.ben.info.ying + '　' + c.ben.info.palaceName + '</div>' +
      '<div class="ask-line"><span class="k">日历</span>' + esc(c.solarText) + '　' + esc(c.lunarText) +
      '　月建' + c.monthGanZhi + '　日辰' + c.dayGanZhi + '</div>' +
      '</div>';
  }
  function stageBar(cur) {
    var m = CFG.MODULES[state.moduleId];
    function st(i, txt) {
      var cls = cur > i ? ' done' : (cur === i ? ' run' : '');
      return '<span class="st' + cls + '">' + txt + '</span>';
    }
    return '<div class="steps-bar">' + st(1, '① 卦象总断') + '<i class="arw">›</i>' +
      st(2, '② ' + m.name + '深化') + '</div>';
  }
  function noKeyCard() {
    return '<div class="card nokey">' +
      '<div class="nk-t">尚未配置大模型</div>' +
      '<p class="nk-p">本小程序采用两段式解析：先用「六爻助手」提示词对排盘做卦象总断，再把总断结果连同该模块的专属提示词交给「' +
      CFG.MODULES[state.moduleId].name + '顾问」深化成落地方案。两段都调用大模型，因此需要先配置接口。</p>' +
      '<button class="btn-main" id="btnGoSet">去设置</button>' +
      '</div>';
  }
  function tailBlocks() {
    var html = '';
    if (state.aiStage1) {
      html += '<details class="card fold"><summary>幕后：第一阶段「卦象总断」原文</summary>' +
        '<div class="ai-out">' + esc(state.aiStage1) + '</div></details>';
    }
    html += '<div class="card note">以上由「六爻助手 + ' + CFG.MODULES[state.moduleId].name +
      '顾问」两段提示词依次推演，属决策辅助与文化参考，不构成医疗、法律或财务建议。</div>';
    html += '<button class="btn-main" id="btnSave">保存此卦</button>';
    return html;
  }
  function renderResult() {
    if (!hasKey()) {
      $('#resBox').innerHTML = ctxCard() + noKeyCard();
      $('#btnGoSet').addEventListener('click', function () {
        $('#tabbar').querySelectorAll('a').forEach(function (x) { x.classList.remove('on'); });
        $('#tabbar').querySelector('[data-tab="set"]').classList.add('on');
        switchView('set');
      });
      return;
    }
    if (state.aiFinal) {
      $('#resBox').innerHTML = ctxCard() + stageBar(3) +
        '<div class="card ai-out" id="aiOut">' + esc(state.aiFinal) + '</div>' + tailBlocks();
      return;
    }
    $('#resBox').innerHTML = ctxCard() + stageBar(1) +
      '<div class="card ai-out" id="aiOut"><span class="blink">① 六爻助手正在推演卦象总断…</span></div>';
  }

  // ---------- LLM 调用 ----------
  function hasKey() { return !!localStorage.getItem('wy_key'); }
  function getCfg() {
    return {
      base: localStorage.getItem('wy_base') || '',
      model: localStorage.getItem('wy_model') || '',
      key: localStorage.getItem('wy_key') || ''
    };
  }
  function callLLM(c, messages, onDelta) {
    return fetch(c.base.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.key },
      body: JSON.stringify({ model: c.model, messages: messages, temperature: 0.7, stream: true })
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error('HTTP ' + res.status + ' ' + t.slice(0, 120));
        });
      }
      if (!res.body) return res.json().then(function (j) { return j.choices[0].message.content; });
      var reader = res.body.getReader(), dec = new TextDecoder('utf-8'), buf = '', acc = '';
      return (function pump() {
        return reader.read().then(function (r) {
          if (r.done) return acc;
          buf += dec.decode(r.value, { stream: true });
          var parts = buf.split('\n'); buf = parts.pop();
          parts.forEach(function (line) {
            line = line.trim();
            if (line.indexOf('data:') !== 0) return;
            var payload = line.slice(5).trim();
            if (payload === '[DONE]') return;
            try {
              var j = JSON.parse(payload);
              var d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
              if (d) { acc += d; if (onDelta) onDelta(acc); }
            } catch (e) { }
          });
          return pump();
        });
      })();
    });
  }
  function runTwoStage() {
    var c = getCfg();
    if (!c.key) { toast('请先在设置页配置 API Key'); return; }
    state.aiFinal = ''; state.aiStage1 = '';
    var m = CFG.MODULES[state.moduleId];
    $('#resBox').innerHTML = ctxCard() + stageBar(1) +
      '<div class="card ai-out" id="aiOut"><span class="blink">① 六爻助手正在推演卦象总断…</span></div>';
    callLLM(c, CFG.buildStage1Messages(state.moduleId, state.text, state.chart), null)
      .then(function (t1) {
        state.aiStage1 = t1;
        $('#resBox').innerHTML = ctxCard() + stageBar(2) +
          '<div class="card ai-out" id="aiOut"><span class="blink">② ' + m.name + '顾问正在结合总断深化方案…</span></div>';
        return callLLM(c, CFG.buildStage2Messages(state.moduleId, state.text, state.chart, t1), function (acc) {
          var o = $('#aiOut'); if (o) o.textContent = acc;
        });
      })
      .then(function (t2) {
        state.aiFinal = t2;
        $('#resBox').innerHTML = ctxCard() + stageBar(3) +
          '<div class="card ai-out" id="aiOut">' + esc(t2) + '</div>' + tailBlocks();
      })
      .catch(function (err) {
        $('#resBox').innerHTML = ctxCard() +
          '<div class="card err-card"><p class="err-t">调用失败</p>' +
          '<p class="err-m">' + esc(err.message) + '</p>' +
          '<p class="note">常见原因：Key 无效或余额不足、base URL 写错、模型名不匹配；在浏览器预览页直连时还可能是跨域限制，请用微信开发者工具打开 miniprogram 工程。</p>' +
          '<button class="btn-main" id="btnRetry">重新解析</button></div>';
        $('#btnRetry').addEventListener('click', function () { runTwoStage(); });
      });
  }

  $('#resSwitch').addEventListener('click', function () {
    if (!hasKey()) { toast('请先在设置页配置 Key'); return; }
    runTwoStage(); toast('已重新发起两段解析');
  });

  // ---------- 导航 ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act;
    if (a === 'toHome') switchView('home');
    if (a === 'toDiv') switchView('div');
  });
  $('#tabbar').addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a) return;
    var t = a.dataset.tab;
    $('#tabbar').querySelectorAll('a').forEach(function (x) { x.classList.toggle('on', x === a); });
    if (t === 'home') switchView('home'); else switchView('set');
  });

  // ---------- 设置 ----------
  function loadCfgUI() {
    var base = localStorage.getItem('wy_base') || 'https://api.deepseek.com/v1';
    var model = localStorage.getItem('wy_model') || 'deepseek-chat';
    $('#apiBase').value = base; $('#apiModel').value = model;
    $('#apiKey').value = localStorage.getItem('wy_key') || '';
    updateKeyState();
  }
  function updateKeyState() {
    var k = localStorage.getItem('wy_key');
    $('#keyState').textContent = k ? '当前：' + (localStorage.getItem('wy_model') || '') + ' · 已配置 Key（' + k.slice(0, 6) + '***）' : '当前：未配置，使用离线引擎';
  }
  $('#apiPreset').addEventListener('change', function () {
    var v = this.value; if (v === 'custom') return;
    var sp = v.split('|');
    $('#apiBase').value = sp[0]; $('#apiModel').value = sp[1];
  });
  $('#btnSaveKey').addEventListener('click', function () {
    localStorage.setItem('wy_base', $('#apiBase').value.trim());
    localStorage.setItem('wy_model', $('#apiModel').value.trim());
    localStorage.setItem('wy_key', $('#apiKey').value.trim());
    updateKeyState(); toast('已保存');
  });

  // ---------- 启动 ----------
  renderHome();
  loadCfgUI();
})();
