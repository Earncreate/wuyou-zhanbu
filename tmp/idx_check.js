
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
    raw: [],
    birthDate: '',
    birthYearGanZhi: '',
    gender: ''
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
    // 统一以北京时间(UTC+8)定四柱，避免设备时区不同导致时柱/日柱偏差
    var bj = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60000);
    var lunar = window.Lunar.fromDate(bj);
    var prev = lunar.getPrevJieQi(), next = lunar.getNextJieQi();
    return {
      month: lunar.getMonthInGanZhi(),
      day: lunar.getDayInGanZhi(),
      jieqi: prev ? prev.getName() : '',
      nextJieqi: next ? next.getName() : '',
      solarText: bj.getFullYear() + '年' + (bj.getMonth() + 1) + '月' + bj.getDate() + '日',
      lunarText: lunar.getMonthInChinese() + '月' + lunar.getDayInChinese(),
      beijing: beijingTime(d),
      ganzhiYear: lunar.getYearInGanZhi(),
      hour: lunar.getTimeInGanZhi()
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
    var fab = $('#btnHistoryFab'); if (fab) fab.style.display = (id === 'home') ? '' : 'none';
    window.scrollTo(0, 0);
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  // ---------- 首页模块列表 ----------
  function renderHome() {
    var g = nowGanzhi();
    $('#heroGz').textContent = g.ganzhiYear + '年 · 月建' + g.month + ' · 日辰' + g.day + ' · ' + g.jieqi;
    var html = '';
    CFG.MOD_GROUPS.forEach(function (grp) {
      html += '<div class="grp-title">' + esc(grp.name) + '</div>';
      if (grp.key === 'life') {
        grp.ids.forEach(function (id) {
          var m = CFG.MODULES[id];
          html += '<div class="mod-card" data-mod="' + id + '" style="--mc:' + m.color + ';--mc2:' + m.color2 + '">' +
            '<div class="mod-icon">' + m.icon + '</div>' +
            '<div class="mod-body"><div class="mod-name">' + m.name + '</div>' +
            '<div class="mod-sub">' + m.subtitle + '</div>' +
            '<div class="mod-desc">' + m.desc + '</div></div>' +
            '<div class="mod-arrow">›</div></div>';
        });
      } else {
        html += '<div class="chip-grid">';
        grp.ids.forEach(function (id) {
          var m = CFG.MODULES[id];
          html += '<div class="mod-card mod-chip" data-mod="' + id + '" style="--mc:' + m.color + ';--mc2:' + m.color2 + '">' +
            '<div class="mod-icon">' + m.icon + '</div>' +
            '<div class="mod-body"><div class="mod-name">' + m.name + '</div>' +
            '<div class="mod-sub">' + m.subtitle + '</div></div></div>';
        });
        html += '</div>';
      }
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
  function updateFabBadge(n) {
    var b = $('#fabBadge'); if (b) b.textContent = n || 0;
  }
  function renderHistory() {
    var list = getHistory();
    var body = $('#historyDrawerBody');
    if (!body) return;
    var order = [];
    CFG.MOD_GROUPS.forEach(function (g) { g.ids.forEach(function (id) { order.push(id); }); });
    var mods = [];
    list.forEach(function (r) { if (r.moduleId && mods.indexOf(r.moduleId) < 0) mods.push(r.moduleId); });
    mods.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    updateFabBadge(list.length);
    if (!list.length || !mods.length) {
      body.innerHTML = '<div class="empty">还没有保存的记录，起卦后点「保存此卦」即可存入对应分组</div>' + feedbackStatsHTML();
      return;
    }
    var cats = mods.map(function (id) {
      var m = CFG.MODULES[id];
      var recs = [];
      list.forEach(function (r, i) { if (r.moduleId === id) recs.push({ r: r, i: i }); });
      var rows = recs.map(function (o) {
        var r = o.r;
        // 阳历日期 + 北京时间（不含星期）
        var bj = r.beijing || '';
        var bm = bj.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/);
        var solarRaw = r.solar ? String(r.solar).replace(/^公历\s*/, '') : '';
        var solarTxt = solarRaw || (bm ? (bm[1] + '-' + bm[2] + '-' + bm[3]) : '');
        var bjTxt = bm ? (bm[4] + ' 北京时间') : (bj || '');
        var fbk = getFeedback()[(r.moduleId || '') + '|' + (r.gua || '') + '|' + (r.beijing || '')] || '';
        return '<div class="rec-row" data-rec="' + o.i + '">' + recFigHTML(r.six || (r.chart && r.chart.ben && r.chart.ben.six)) +
          '<div class="rec-mid"><b class="rg">' + esc(r.gua) + (r.aiFinal ? '<i class="tag-ai">已存解读</i>' : '') +
          (fbk ? '<i class="tag-ai">' + esc(fbk) + '</i>' : '') + '</b><span class="ra">' + esc(r.text || '（未填写）') + '</span></div>' +
          '<div class="rt"><span class="rt-s">阳历 ' + esc(solarTxt) + '</span><span class="rt-b">' + esc(bjTxt) + '</span></div>' +
          '<i class="rec-del" data-del="' + o.i + '">✕</i></div>';
      }).join('');
      return '<div class="cat open" style="--mc:' + m.color + '"><div class="cat-head" data-cat="' + id + '">' +
        '<span class="ci">' + m.icon + '</span><span class="cn">' + m.name + '</span>' +
        '<span class="cc">' + recs.length + '</span><i class="chev">›</i></div>' +
        '<div class="cat-body">' + rows + '</div></div>';
    }).join('');
    body.innerHTML = cats + feedbackStatsHTML();
  }
  // 应验统计：把反馈数据变成可见的准头，用作事后校准这套断卦的依据
  function feedbackStatsHTML() {
    var fb = getFeedback(), keys = Object.keys(fb);
    if (!keys.length) return '';
    var yes = 0, part = 0, no = 0, pending = 0;
    keys.forEach(function (k) {
      var v = fb[k];
      if (v === '应验') yes++; else if (v === '部分应验') part++;
      else if (v === '未到应期') pending++; else no++;
    });
    var rate = Math.round(((yes + part * 0.5) / keys.length) * 100);
    return '<div class="card note">我的卦准头：共反馈 ' + keys.length + ' 卦 —— 应验 ' + yes +
      '、部分应验 ' + part + '、未应验 ' + no + '、未到应期 ' + pending +
      '　综合应验率约 ' + rate + '%（部分计半）。数据只存本机，用于事后校准断卦与应期规则，不构成任何承诺。</div>';
  }
  function doSave() {
    if (!state.chart) return;
    var m = CFG.MODULES[state.moduleId];
    var rec = {
      id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      moduleId: state.moduleId, modName: m.name, text: state.text || '',
      gua: state.chart.ben.name + (state.chart.bian ? ' 之 ' + state.chart.bian.name : ''),
      six: state.chart.ben.six, solar: state.chart.solarText, beijing: state.beijing || beijingTime(),
      chart: state.chart, raw: state.raw,
      birthDate: state.birthDate || '', gender: state.gender || '', birthYearGanZhi: state.birthYearGanZhi || '',
      aiFinal: state.aiFinal || '', aiStage1: state.aiStage1 || '', createdAt: Date.now()
    };
    // 本机存储可能写满：依次降级（完整 → 丢总断原文 → 再丢卦象对象），保证解读正文一定留下来
    var saved = saveRecordSafe(rec);
    if (!saved) { toast('保存失败：本机存储已满，请先到首页清空部分记录'); return; }
    toast('已存入「' + m.name + '」记录' + (rec.aiFinal ? '（含解读）' : '（未含解读）'));
    var b = $('#btnSave'); if (b) { b.textContent = '已保存 ✓'; b.disabled = true; }
    renderHistory();
  }
  function saveRecordSafe(rec) {
    var tries = [rec];
    if (rec.aiStage1) tries.push(Object.assign({}, rec, { aiStage1: '' }));
    tries.push(Object.assign({}, rec, { aiStage1: '', chart: null }));
    for (var i = 0; i < tries.length; i++) {
      try { saveRecord(tries[i]); return true; } catch (e) { /* 配额不足，试下一档 */ }
    }
    // 仍失败：清掉旧记录，只保这一卦的解读正文
    try {
      var minimal = Object.assign({}, rec, { aiStage1: '', chart: null });
      var list = getHistory();
      while (list.length > 5) list.pop();
      localStorage.setItem('wy_records', JSON.stringify([minimal].concat(list)));
      return true;
    } catch (e) { return false; }
  }

  function restoreRecord(idx) {
    var rec = getHistory()[idx]; if (!rec) return;
    state.moduleId = rec.moduleId; state.text = rec.text || ''; state.chart = rec.chart; state.beijing = rec.beijing;
    state.birthDate = rec.birthDate || ''; state.gender = rec.gender || ''; state.birthYearGanZhi = rec.birthYearGanZhi || '';
    // 记录里若已存过解读，直接复用，避免重复调用大模型
    state.aiFinal = rec.aiFinal || ''; state.aiStage1 = rec.aiStage1 || '';
    renderDivination();
    if (rec.raw) {
      state.raw = rec.raw; drawDots(rec.raw);
      $('#tossTip').textContent = '成卦：' + (state.chart && state.chart.ben ? state.chart.ben.name : '');
    }
    if (state.chart) renderChart(state.chart);
    // 记录里存过解读就直接进结果页看解读；否则进起卦页
    if (rec.aiFinal) { switchView('res'); renderResult(); toast('已还原该卦的解读'); }
    else switchView('div');
  }
  $('#historyDrawerBody').addEventListener('click', function (e) {
    var del = e.target.closest('.rec-del');
    if (del) {
      var di = +del.dataset.del;
      var list = getHistory(); list.splice(di, 1);
      localStorage.setItem('wy_records', JSON.stringify(list)); renderHistory(); toast('已删除');
      return;
    }
    var head = e.target.closest('.cat-head');
    if (head) { head.parentElement.classList.toggle('open'); return; }
    var row = e.target.closest('.rec-row'); if (!row) return;
    restoreRecord(+row.dataset.rec); closeDrawer();
  });
  function openDrawer() { $('#historyMask').classList.add('show'); $('#historyDrawer').classList.add('show'); }
  function closeDrawer() { $('#historyMask').classList.remove('show'); $('#historyDrawer').classList.remove('show'); }
  $('#btnHistoryFab').addEventListener('click', openDrawer);
  $('#historyMask').addEventListener('click', closeDrawer);
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#drawerClear').addEventListener('click', function () {
    if (!confirm('确定清空全部记录？')) return;
    localStorage.removeItem('wy_records'); renderHistory(); toast('已清空');
  });
  $('#resBox').addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('#btnSave') : null;
    if (b) doSave();
  });

  // ---------- 进入起卦页 ----------
  $('#modList').addEventListener('click', function (e) {
    var c = e.target.closest('.mod-card'); if (!c) return;
    enterModule(c.dataset.mod);
  });
  function enterModule(id) {
    state.moduleId = id; state.text = ''; state.chart = null; state.raw = [];
    state.aiFinal = ''; state.aiStage1 = '';
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
      '<div class="q-title">这一卦你想问的具体心事（选填，留空用默认问法）</div>' +
      '<textarea id="askText" class="ask-text" placeholder="' + esc(CFG.askPlaceholder(state.moduleId)) + '">' + esc(state.text || CFG.ASK_DEFAULT[state.moduleId] || '') + '</textarea>' +
      '<div class="q-hint">属性不再由你勾选，将由卦象总断推导后，由模块顾问匹配给出建议。</div>';
    // 出生信息：仅在「终身运/年运」模块下设置，其它模块一律不显示
    if (state.moduleId === 'fyear') {
      html += '<div class="q-title" style="margin-top:12px">求测人信息（仅本模块，选填）</div>';
      html += '<div class="birth-row">' +
        '<label class="birth-field"><span>出生日期</span><input id="birthDate" class="ask-text" type="date" min="1900-01-01" max="2100-12-31" value="' + esc(state.birthDate || '') + '"></label>' +
        '<div class="birth-field"><span>性别</span><div class="sex-pick">' +
          '<label><input type="radio" name="gender" value="男" ' + (state.gender === '男' ? 'checked' : '') + '>男</label>' +
          '<label><input type="radio" name="gender" value="女" ' + (state.gender === '女' ? 'checked' : '') + '>女</label>' +
        '</div></div>' +
      '</div>';
      html += '<div class="q-hint">填了出生日期，本模块按「生年纳音」立年命与世爻比根基强弱；不填则按当年太岁论年运。性别仅用于区分男女取用。</div>';
    }
    html += '</div>';
    $('#qaBox').innerHTML = html;
    var ta = $('#askText');
    if (ta) { ta.addEventListener('input', function () { state.text = ta.value; state.aiFinal = ''; state.aiStage1 = ''; }); }
    var bd = $('#birthDate');
    if (bd) { bd.addEventListener('change', function () { state.birthDate = bd.value; }); }
    document.querySelectorAll('input[name="gender"]').forEach(function (r) {
      r.addEventListener('change', function () { if (r.checked) state.gender = r.value; });
    });

    // 重置摇卦区
    state.raw = [];
    $('#yaoDots').querySelectorAll('i').forEach(function (i) { i.className = ''; });
    $('#tossTip').textContent = '心念既定，摇钱起卦';
    $('#chartBox').classList.add('hide');
    $('#chartBox').innerHTML = '';
  }

    // 属性不再由用户勾选：无选项点击逻辑

  $('#divReset').addEventListener('click', function () {
    state.raw = []; state.chart = null; state.aiFinal = ''; state.aiStage1 = '';
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
        // 终身/年运：计算出生年干支（立年命），并标识用年干起六神
        var birthGZ = '';
        if (state.moduleId === 'fyear' && state.birthDate) {
          var bp = state.birthDate.split('-');
          var yr = parseInt(bp[0], 10), mo = parseInt(bp[1], 10), da = parseInt(bp[2], 10);
          if (!isNaN(yr) && window.Lunar && window.Lunar.fromYmd) {
            try { birthGZ = window.Lunar.fromYmd(yr, (mo || 1), (da || 1)).getYearInGanZhi(); } catch (e) { birthGZ = ''; }
          }
        }
        state.birthYearGanZhi = birthGZ;
        state.chart = LY.arrange({
          monthGanZhi: g.month, dayGanZhi: g.day, yearGanZhi: g.ganzhiYear, hourGanZhi: g.hour, jieqi: g.jieqi,
          solarText: '公历 ' + g.solarText, lunarText: '农历' + g.lunarText,
          six: state.raw,
          useYearShen: !!(m && m.useYearShen),
          birthYearGanZhi: birthGZ
        });
        state.chart.gender = (state.moduleId === 'fyear') ? (state.gender || '') : '';
        state.chart.birthDate = (state.moduleId === 'fyear') ? (state.birthDate || '') : '';
        state.beijing = g.beijing;
        state.aiFinal = ''; state.aiStage1 = '';
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
        '<span class="c-tag">' + ((y.mark || '') + (y.shiTag || '')) + '</span>' +
        '<span class="c-lq ' + lqClass(y.liuqin) + '">' + y.liuqin + '</span>' +
        '<span class="c-gz">' + y.ganzhi + '</span>' +
        '<span class="c-wx wx-' + y.wuxing + '">' + y.wuxing + '</span>' +
        '<span class="c-flag">' + flagText(y) + '</span>' +
        '</div>';
    }).join('');
  }
  // 对照表单元（本卦 / 变卦 各一列）；变卦列不挂徽章（动属本卦，且列窄防溢出）
  function yaoCellHTML(y, noBadge) {
    var tag = (y.mark || '') + (y.shiTag || '');
    return '<div class="c-b' + (y.isMoving ? ' mv' : '') + '">' +
      '<span class="c-sym">' + (y.yang ? '<i class="ln yang' + (y.isMoving ? ' m' : '') + '"></i>' : '<i class="ln yin' + (y.isMoving ? ' m' : '') + '"></i><i class="ln yin' + (y.isMoving ? ' m' : '') + '"></i>') + '</span>' +
      '<span class="c-tag' + (tag ? '' : ' c-tag-empty') + '">' + tag + '</span>' +
      '<span class="c-lq ' + lqClass(y.liuqin) + '">' + y.liuqin + '</span>' +
      '<span class="c-gz">' + y.ganzhi + '</span>' +
      (noBadge ? '' : yaoBadges(y)) +
      '</div>';
  }
  function lqClass(lq) {
    return { 父母: 'lq-p', 官鬼: 'lq-g', 妻财: 'lq-c', 子孙: 'lq-z', 兄弟: 'lq-b' }[lq] || '';
  }
  function flagText(y) {
    var f = [];
    if (y.wang && y.wang.level === '旺') f.push('旺');
    if (y.wang && y.wang.level === '衰极') f.push('衰');
    return f.join(' ');
  }
  function yaoBadges(y) {
    var b = '';
    if (y.isKong) b += '<span class="badge kong">空</span>';
    if (y.isYuePo) b += '<span class="badge po">破</span>';
    if (y.isMoving) b += '<span class="badge dong">' + (y.old === '阳' ? '阳动' : '阴动') + '</span>';
    if (y.wang && y.wang.level === '旺') b += '<span class="badge wang">旺</span>';
    return b ? '<span class="c-badges">' + b + '</span>' : '';
  }
  function guaFigureHTML(gua) {
    return '<div class="fig">' + gua.six.slice().reverse().map(function (b, i) {
      var idx = 5 - i;
      var mv = gua.__moving && gua.__moving.indexOf(idx) >= 0;
      return b ? '<i class="ln yang' + (mv ? ' m' : '') + '"></i>' : '<i class="ln yin' + (mv ? ' m' : '') + '"></i><i class="ln yin' + (mv ? ' m' : '') + '"></i>';
    }).join('<br>') + '</div>';
  }

  function gistText(chart) {
    var m = CFG.MODULES[state.moduleId]; if (!m) return '';
    var ysYao = chart.ben.yaos.filter(function (y) { return y.liuqin === m.yongshen; })[0];
    if (!ysYao) return '';
    var lvl = ysYao.wang ? ysYao.wang.level : '';
    var tags = [];
    if (ysYao.isShi) tags.push('持世');
    if (ysYao.isKong) tags.push('旬空');
    if (ysYao.isYuePo) tags.push('月破');
    if (ysYao.isMoving) tags.push('发动');
    if (ysYao.isRiChong) tags.push('日冲');
    var near = '';
    if (LY.yingqiOf) {
      var cands = LY.yingqiOf(ysYao, chart).filter(function (c) { return c.zhi; });
      if (cands.length) {
        var D = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
        var dz = chart.dayZhi;
        cands.forEach(function (c) { c.days = (c.zhi === dz) ? 0 : (D.indexOf(c.zhi) - D.indexOf(dz) + 12) % 12; });
        cands.sort(function (a, b) { return a.days - b.days; });
        near = '最近应期：' + cands[0].zhi + '日（距今第 ' + cands[0].days + ' 天）';
      }
    }
    var ym = '';
    if (chart.useYearShen && chart.yearMing) {
      var rel = chart.yearMing.rels.length ? chart.yearMing.rels[0] : '年命与世爻平和无冲克';
      ym = '；年命' + chart.yearMing.ming + '：' + rel;
    }
    return '用神<b>' + m.yongshen + '</b>（' + ysYao.posName + '）·' + lvl + (tags.length ? ' · ' + tags.join('') : '') + (near ? '；' + near : '') + ym;
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
    // 结果前置：引擎直接算的一句速览，点 AI 前就能看懂大概
    html += '<div class="gist">' + gistText(chart) + '</div>';
    html += '<div class="yongshen">用神 <b>' + m.yongshen + '</b>　原神 <b>' + m.yuanshen + '</b>　忌神 <b>' + m.jishen + '</b>　仇神 <b>' + m.choushen + '</b></div>';

    // 本卦 / 变卦 对照：静卦单列、有变双列
    var hasBian = !!chart.bian;
    var bianRev = hasBian ? chart.bian.yaos.slice().reverse() : null;
    var cmp = '<div class="cmp"><div class="cmp-row cmp-head"><span class="c-shen">六神</span>' +
      '<span class="c-cap">本卦 · ' + chart.ben.name + '</span>' +
      (hasBian ? '<span class="c-cap">变卦 · ' + chart.bian.name + '</span>' : '') + '</div>';
    chart.ben.yaos.slice().reverse().forEach(function (y, i) {
      var by = bianRev ? bianRev[i] : null;
      cmp += '<div class="cmp-row' + (y.isMoving ? ' mv' : '') + '">' +
        '<span class="c-shen">' + y.liushen + '</span>' +
        yaoCellHTML(y) + (by ? yaoCellHTML(by, true) : '') + '</div>';
    });
    cmp += '</div>';
    html += cmp;

    // 图例：世应空破动一眼可辨
    html += '<div class="legend"><span class="lg"><i class="dot" style="background:#FCEBEB;border:1px solid #A32D2D"></i>世爻</span>' +
      '<span class="lg"><i class="dot" style="background:#E6F1FB;border:1px solid #185FA5"></i>应爻</span>' +
      '<span class="lg"><i class="dot" style="background:#FAEEDA;border:1px solid #854F0B"></i>空亡</span>' +
      '<span class="lg"><i class="dot" style="background:#FCEBEB;border:1px solid #A32D2D"></i>月破</span>' +
      '<span class="lg"><i class="dot" style="background:#F3E9FB;border:1px solid #7a3fb0"></i>动爻</span></div>';

    // 起卦信息（折叠，默认收起）
    html += '<details class="fold"><summary>起卦信息（月建 · 日辰 · 旬空 · 月破 · 节气）</summary><div class="fold-body">' +
      esc(chart.solarText) + '　' + esc(chart.lunarText) + '<br>' +
      '年 ' + esc(chart.yearGanZhi || '') + '　月 ' + chart.monthGanZhi + '　日 ' + chart.dayGanZhi +
      (chart.hourGanZhi ? '　时 ' + chart.hourGanZhi : '') + '<br>' +
      '旬空 <b>' + chart.xunkong.join('、') + '</b>　月破 <b>' + chart.yuepo + '</b>' +
      (chart.jieqi ? '<br>节气 ' + chart.jieqi : '') +
      (chart.useYearShen ? '<br>六神起自年干 <b>' + (chart.shenGanZhi ? chart.shenGanZhi.charAt(0) : '') + '</b>' +
        (chart.birthYearGanZhi ? '　年命 <b>' + chart.birthYearGanZhi + '（纳音' + (chart.yearMing ? chart.yearMing.ming : '') + '）</b>' : '　（未填出生年，按当年太岁论年运）') : '') +
      (chart.gender || chart.birthDate ? '<br>求测人' + (chart.gender ? ' 性别 ' + esc(chart.gender) : '') + (chart.birthDate ? ' 出生 ' + esc(chart.birthDate) : '') : '') +
      '</div></details>';

    // 伏神（折叠，默认收起，写明飞伏）
    if (chart.ben.fu && chart.ben.fu.length) {
      var fuRev = chart.ben.fu.slice().reverse();
      html += '<details class="fold"><summary>伏神（' + chart.ben.info.palaceName + ' · 本宫伏神，点开见飞伏对照）</summary><div class="fold-body">' +
        fuRev.map(function (f) {
          return '<div class="fu-row"><span class="c-lq ' + lqClass(f.liuqin) + '">' + f.liuqin + '</span>' +
            '<span class="c-gz">' + f.ganzhi + '</span>' +
            '<span class="c-tag">伏于' + ['初', '二', '三', '四', '五', '上'][f.pos - 1] + '爻之下</span></div>';
        }).join('') + '</div></details>';
    }
    html += '</div>';

    html += '<button class="btn-main big" id="btnAi">AI 智能体解析</button>';
    html += '<div class="sub-tip">两段串接：① 六爻助手做卦象总断　② ' + m.name + '顾问做落地方案</div>';

    $('#chartBox').innerHTML = html;
    $('#chartBox').classList.remove('hide');
    $('#btnAi').addEventListener('click', function () {
      // 已有解析结果（本次刚解析完，或从记录还原）则直接展示，不再重复调用大模型
      if (state.aiFinal) {
        switchView('res');
        renderResult();
        toast('已载入已有解析（点「重新解析」才会重新调用模型）');
        return;
      }
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
    var fkey = (state.moduleId || '') + '|' + (state.chart && state.chart.ben ? state.chart.ben.name : '') + '|' + (state.beijing || '');
    var fbMap = getFeedback();
    html += '<div class="card note" id="fbRow" data-fkey="' + esc(fkey) + '">此卦后续应验了吗？' +
      '<span class="fb-btn" data-fb="应验">应验了</span>　<span class="fb-btn" data-fb="部分应验">部分应验</span>　' +
      '<span class="fb-btn" data-fb="未应验">没应验</span>　<span class="fb-btn" data-fb="未到应期">未到应期</span>' +
      (fbMap[fkey] ? '<div class="q-hint">已记录：' + esc(fbMap[fkey]) + '</div>' : '<div class="q-hint">反馈只存本机，用于事后复盘这套断卦的准头</div>') +
      '</div>';
    html += '<button class="btn-main" id="btnSave">保存此卦</button>';
    return html;
  }
  function getFeedback() {
    try { return JSON.parse(localStorage.getItem('wy_feedback') || '{}'); } catch (e) { return {}; }
  }
  // 总断缓存：同一卦 + 同一四柱 + 同一模块 + 同一动爻组，第一阶段结果确定，可复用
  function stage1CacheKey() {
    var c = state.chart; if (!c) return '';
    return [state.moduleId, c.ben.name, c.bian ? c.bian.name : '-',
      c.yearGanZhi || '', c.monthGanZhi || '', c.dayGanZhi || '', c.hourGanZhi || '',
      (c.moving || []).map(function (m) { return m.pos; }).join('')].join('|');
  }
  function getStage1Cache() {
    try { return JSON.parse(localStorage.getItem('wy_t1cache') || '{}'); } catch (e) { return {}; }
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
    var t0 = Date.now();
    var m = CFG.MODULES[state.moduleId];
    var quick = localStorage.getItem('wy_quick') === '1';
    var ckey = stage1CacheKey();
    var cached = (!quick && ckey) ? getStage1Cache()[ckey] : '';
    var stage1Promise;
    if (quick) {
      $('#resBox').innerHTML = ctxCard() + stageBar(2) +
        '<div class="card ai-out" id="aiOut"><span class="blink">快速模式：' + m.name + '顾问直接断卦（省去总断）…</span></div>';
      stage1Promise = Promise.resolve('（快速模式：未做第一阶段总断。请直接依据排盘文本自行断卦：先给出卦象总断要点——用神旺衰、日月力量结论、应期候选，再输出落地方案，不得省略依据。）');
    } else {
      if (cached) {
        $('#resBox').innerHTML = ctxCard() + stageBar(2) +
          '<div class="card ai-out" id="aiOut"><span class="blink">② ' + m.name + '顾问正在深化方案…（卦象总断命中本机缓存，省去 ①）</span></div>';
        stage1Promise = Promise.resolve(cached);
      } else {
        $('#resBox').innerHTML = ctxCard() + stageBar(1) +
          '<div class="card ai-out" id="aiOut"><span class="blink">① 六爻助手正在推演卦象总断…</span></div>';
        stage1Promise = callLLM(c, CFG.buildStage1Messages(state.moduleId, state.text, state.chart), function (acc) {
          var o = $('#aiOut'); if (o) o.textContent = '① 卦象总断（生成中）…\n' + acc;
        });
      }
    }
    stage1Promise
      .then(function (t1) {
        state.aiStage1 = t1;
        if (!quick && ckey && !cached) {
          var cc = getStage1Cache(); cc[ckey] = t1;
          var ks = Object.keys(cc); if (ks.length > 40) delete cc[ks[0]];
          try { localStorage.setItem('wy_t1cache', JSON.stringify(cc)); } catch (e) { }
        }
        var sec = ((Date.now() - t0) / 1000).toFixed(1);
        $('#resBox').innerHTML = ctxCard() + stageBar(2) +
          '<div class="card ai-out" id="aiOut"><span class="blink">② ' + m.name + '顾问正在深化方案…' +
          (quick ? '' : (cached ? '（总断命中缓存）' : '（总断用时 ' + sec + ' 秒）')) + '</span></div>';
        return callLLM(c, CFG.buildStage2Messages(state.moduleId, state.text, state.chart, t1), function (acc) {
          var o = $('#aiOut'); if (o) o.textContent = acc;
        });
      })
      .then(function (t2) {
        state.aiFinal = t2;
        var sec = ((Date.now() - t0) / 1000).toFixed(1);
        $('#resBox').innerHTML = ctxCard() + stageBar(3) +
          '<div class="card ai-out" id="aiOut">' + esc(t2) + '</div><div class="note">' + (quick ? '快速模式' : '两段') + '总耗时 ' + sec + ' 秒</div>' + tailBlocks();
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
    $('#quickMode').value = localStorage.getItem('wy_quick') || '0';
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
    localStorage.setItem('wy_quick', $('#quickMode').value);
    updateKeyState(); toast('已保存');
  });

  // ---------- 应验反馈 ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.fb-btn'); if (!b) return;
    var row = b.closest('#fbRow'); if (!row) return;
    var map = getFeedback();
    map[row.dataset.fkey] = b.dataset.fb;
    try { localStorage.setItem('wy_feedback', JSON.stringify(map)); } catch (err) { }
    row.innerHTML = '已记录反馈：' + b.dataset.fb + '（只存本机；同一卦再问会显示历史反馈）';
    toast('已记录，感谢反馈');
  });

  // ---------- 启动 ----------
  renderHome();
  loadCfgUI();
})();
