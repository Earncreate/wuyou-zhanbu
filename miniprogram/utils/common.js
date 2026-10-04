/**
 * 小程序端：历法取用、模型配置、装卦上下文（供四个页面复用）
 */
var Lunar = require('./lunar.js').Lunar;
var LY = require('./liuyao.js');
var CFG = require('./config.js');

// 起卦时刻的月建（按节气）、日辰、旬空
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function beijingTime(d) {
  d = d || new Date();
  // 将设备本地时间换算到 UTC+8（北京时间）
  var bj = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60000);
  return bj.getFullYear() + '-' + pad2(bj.getMonth() + 1) + '-' + pad2(bj.getDate()) +
    ' ' + pad2(bj.getHours()) + ':' + pad2(bj.getMinutes()) + ' 北京时间';
}
function nowGanzhi(d) {
  d = d || new Date();
  // 统一以北京时间(UTC+8)定四柱，避免设备时区不同导致时柱/日柱偏差
  var bj = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60000);
  var lunar = Lunar.fromDate(bj);
  var prev = lunar.getPrevJieQi();
  return {
    month: lunar.getMonthInGanZhi(),
    day: lunar.getDayInGanZhi(),
    jieqi: prev ? prev.getName() : '',
    solarText: '公历 ' + bj.getFullYear() + '年' + (bj.getMonth() + 1) + '月' + bj.getDate() + '日',
    lunarText: '农历' + lunar.getMonthInChinese() + '月' + lunar.getDayInChinese(),
    beijing: beijingTime(d),
    ganzhiYear: lunar.getYearInGanZhi(),
    hour: lunar.getTimeInGanZhi()
  };
}

function doToss(g) {
  return LY.tossSix();
}

function arrange(six, g) {
  return LY.arrange({
    monthGanZhi: g.month,
    dayGanZhi: g.day,
    yearGanZhi: g.ganzhiYear,
    hourGanZhi: g.hour,
    jieqi: g.jieqi,
    solarText: g.solarText,
    lunarText: g.lunarText,
    six: six
  });
}

// 排盘数据 → 便于 wxml 渲染的结构
function toPlate(chart) {
  var mv = chart.moving.map(function (m) { return m.index; });
  function rows(yaos) {
    return yaos.slice().reverse().map(function (y) {
      var flags = [];
      if (y.isKong) flags.push('空');
      if (y.isYuePo) flags.push('破');
      if (y.isMoving) flags.push(y.old === '阳' ? '阳动' : '阴动');
      if (y.wang.level === '旺') flags.push('旺');
      if (y.wang.level === '衰极') flags.push('衰');
      return {
        pos: y.pos, posName: y.posName, yang: y.yang, isMoving: y.isMoving, mark: y.mark,
        liushen: y.liushen, liuqin: y.liuqin, ganzhi: y.ganzhi, wuxing: y.wuxing,
        shiTag: y.shiTag, changsheng: y.changsheng, flags: flags.join(' ')
      };
    });
  }
  function figure(six) {
    return six.slice().reverse().map(function (b, i) {
      var idx = 5 - i;
      return { pos: idx, yang: !!b, mv: mv.indexOf(idx) >= 0 };
    });
  }
  return {
    benName: chart.ben.name,
    benLabel: chart.ben.upper.name + '上' + chart.ben.lower.name + '下',
    palace: chart.ben.info.palaceName + '·' + chart.ben.info.element + (chart.ben.info.tag ? '·' + chart.ben.info.tag : ''),
    shi: chart.ben.info.shi, ying: chart.ben.info.ying,
    benFig: figure(chart.ben.six),
    bianFig: chart.bian ? figure(chart.bian.six) : null,
    bianName: chart.bian ? chart.bian.name : '',
    bianLabel: chart.bian ? chart.bian.upper.name + '上' + chart.bian.lower.name + '下' : '',
    movingText: chart.moving.length ? chart.moving.map(function (m) { return chart.ben.yaos[m.index].posName; }).join('、') : '',
    hasBian: !!chart.bian,
    solarText: chart.solarText, lunarText: chart.lunarText, jieqi: chart.jieqi,
    monthGanZhi: chart.monthGanZhi, dayGanZhi: chart.dayGanZhi,
    xunkong: chart.xunkong.join('、'), yuepo: chart.yuepo,
    benRows: rows(chart.ben.yaos),
    bianRows: chart.bian ? rows(chart.bian.yaos) : [],
    fuRows: chart.ben.fu ? chart.ben.fu.slice().reverse().map(function (f) {
      return { pos: f.pos, posName: ['初', '二', '三', '四', '五', '上'][f.pos - 1] + '爻', ganzhi: f.ganzhi, wuxing: f.wuxing, liuqin: f.liuqin };
    }) : []
  };
}

function getCfg() {
  return {
    base: wx.getStorageSync('wy_base') || '',
    model: wx.getStorageSync('wy_model') || '',
    key: wx.getStorageSync('wy_key') || '',
    cloudEnv: wx.getStorageSync('wy_cloud_env') || '',
    useCloud: wx.getStorageSync('wy_use_cloud') === '1'
  };
}
function hasKey() {
  var c = getCfg();
  // 云代理模式下 Key 在云端，本地只需云环境 ID 即视为已配置
  if (c.useCloud) return !!c.cloudEnv;
  return !!c.key;
}

// 走云函数代理：Key 不落客户端
function callLLMViaCloud(messages, cfg, onDelta) {
  return new Promise(function (resolve, reject) {
    if (!wx.cloud || !wx.cloud.callFunction) {
      reject(new Error('当前环境不支持云开发，请改用直连模式'));
      return;
    }
    wx.cloud.callFunction({
      name: 'liuyaoProxy',
      data: { messages: messages, model: cfg.model, temperature: 0.7 },
      success: function (res) {
        var r = (res && res.result) || {};
        if (r.ok) {
          if (onDelta) onDelta(r.content);
          resolve(r.content);
        } else {
          reject(new Error(r.error || '云函数返回失败'));
        }
      },
      fail: function (e) { reject(new Error((e && e.errMsg) || '云函数调用失败')); }
    });
  });
}

// 自动路由：开了云代理走云函数，否则直连
function callLLMAuto(messages, onDelta) {
  var cfg = getCfg();
  if (cfg.useCloud) return callLLMViaCloud(messages, cfg, onDelta);
  if (!cfg.key) return Promise.reject(new Error('未配置 Key，请到设置页填写'));
  return callLLM(messages, cfg, onDelta);
}

// ArrayBuffer -> string
function ab2str(buf) {
  var out = [], arr = new Uint8Array(buf), i = 0, len = arr.length;
  while (i < len) {
    var c = arr[i++];
    if (c < 0x80) out.push(String.fromCharCode(c));
    else if (c < 0xE0) out.push(String.fromCharCode(((c & 0x1F) << 6) | (arr[i++] & 0x3F)));
    else if (c < 0xF0) out.push(String.fromCharCode(((c & 0x0F) << 12) | ((arr[i++] & 0x3F) << 6) | (arr[i++] & 0x3F)));
    else {
      var cp = ((c & 0x07) << 18) | ((arr[i++] & 0x3F) << 12) | ((arr[i++] & 0x3F) << 6) | (arr[i++] & 0x3F);
      cp -= 0x10000;
      out.push(String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)));
    }
  }
  return out.join('');
}

/**
 * 流式请求大模型（OpenAI 兼容协议）
 * @returns Promise<string>
 */
function callLLM(messages, cfg, onDelta) {
  return new Promise(function (resolve, reject) {
    var acc = '', buf = '', settled = false;
    function done(text, err) {
      if (settled) return;
      settled = true;
      if (err) reject(err); else resolve(text);
    }
    function feed(str) {
      buf += str;
      var parts = buf.split('\n');
      buf = parts.pop();
      parts.forEach(function (line) {
        line = line.trim();
        if (line.indexOf('data:') !== 0) return;
        var payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') return;
        try {
          var j = JSON.parse(payload);
          var d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
          if (d) { acc += d; if (onDelta) onDelta(acc); }
        } catch (e) { }
      });
    }
    var url = cfg.base.replace(/\/$/, '') + '/chat/completions';
    var task = wx.request({
      url: url,
      method: 'POST',
      header: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      data: { model: cfg.model, messages: messages, temperature: 0.7, stream: true },
      enableChunked: true,
      dataType: 'text',
      success: function (res) {
        if (res.statusCode !== 200) {
          done('', new Error('HTTP ' + res.statusCode + ' ' + String(res.data || '').slice(0, 120)));
          return;
        }
        if (acc) { done(acc); return; }
        if (typeof res.data === 'object' && res.data.choices) { done(res.data.choices[0].message.content); return; }
        if (typeof res.data === 'string') { try { feed(res.data); } catch (e) { } }
        done(acc || '（接口未返回内容）');
      },
      fail: function (e) { done('', new Error(e.errMsg || '请求失败')); }
    });
    if (task && task.onChunkReceived) {
      task.onChunkReceived(function (chunk) {
        try { feed(ab2str(chunk.data)); } catch (e) { }
      });
    }
  });
}

// 起卦记录
function getRecords() {
  try { return wx.getStorageSync('wy_records') || []; } catch (e) { return []; }
}
function getRecordsByModule(moduleId) {
  return getRecords().filter(function (r) { return r.moduleId === moduleId; });
}
function saveRecord(rec) {
  var list = getRecords();
  list.unshift(rec);
  if (list.length > 20) list = list.slice(0, 20);
  wx.setStorageSync('wy_records', list);
}
function deleteRecord(idx) {
  var list = getRecords();
  list.splice(idx, 1);
  wx.setStorageSync('wy_records', list);
}
function newId() {
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
// 按 id 更新本地记录（用于保存后回填云 id / 补写 AI 解读）
function updateRecordById(id, patch) {
  var list = getRecords();
  var hit = null;
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) { for (var k in patch) list[i][k] = patch[k]; hit = list[i]; break; }
  }
  if (hit) wx.setStorageSync('wy_records', list);
  return hit;
}

// ============ 云开发数据库同步（可选，需先开通云开发并建 records 集合） ============
function cloudEnabled() {
  var c = getCfg();
  return !!(c.useCloud && c.cloudEnv && wx.cloud && wx.cloud.database);
}
function cloudColl() {
  return wx.cloud.database().collection('records');
}
function cloudAdd(rec) {
  return new Promise(function (resolve, reject) {
    if (!cloudEnabled()) { reject(new Error('未启用云同步')); return; }
    cloudColl().add({
      data: {
        localId: rec.id || '', moduleId: rec.moduleId || '', modName: rec.modName || '',
        gua: rec.gua || '', ask: rec.text || '', solar: rec.solar || '', beijing: rec.beijing || '',
        six: rec.six || [], aiFinal: rec.aiFinal || '', aiStage1: rec.aiStage1 || '',
        chart: rec.chart || null,
        createdAt: rec.createdAt || Date.now()
      },
      success: function (r) { resolve(r._id); },
      fail: function (e) { reject(new Error((e && e.errMsg) || '云端写入失败')); }
    });
  });
}
function cloudUpdate(cloudId, patch) {
  return new Promise(function (resolve, reject) {
    if (!cloudEnabled() || !cloudId) { reject(new Error('未启用云同步')); return; }
    cloudColl().doc(cloudId).update({
      data: patch,
      success: resolve,
      fail: function (e) { reject(new Error((e && e.errMsg) || '云端更新失败')); }
    });
  });
}
function cloudList() {
  return new Promise(function (resolve, reject) {
    if (!cloudEnabled()) { reject(new Error('未启用云同步')); return; }
    cloudColl().orderBy('createdAt', 'desc').limit(50).get({
      success: function (r) { resolve(r.data || []); },
      fail: function (e) { reject(new Error((e && e.errMsg) || '云端读取失败')); }
    });
  });
}
function cloudRemove(cloudId) {
  return new Promise(function (resolve, reject) {
    if (!cloudEnabled() || !cloudId) { reject(new Error('未启用云同步')); return; }
    cloudColl().doc(cloudId).remove({
      success: resolve,
      fail: function (e) { reject(new Error((e && e.errMsg) || '云端删除失败')); }
    });
  });
}

module.exports = {
  Lunar: Lunar, LY: LY, CFG: CFG,
  nowGanzhi: nowGanzhi, beijingTime: beijingTime, doToss: doToss, arrange: arrange, toPlate: toPlate,
  getCfg: getCfg, hasKey: hasKey, callLLM: callLLM,
  callLLMViaCloud: callLLMViaCloud, callLLMAuto: callLLMAuto,
  getRecords: getRecords, getRecordsByModule: getRecordsByModule, saveRecord: saveRecord, deleteRecord: deleteRecord,
  newId: newId, updateRecordById: updateRecordById,
  cloudEnabled: cloudEnabled, cloudAdd: cloudAdd, cloudUpdate: cloudUpdate, cloudList: cloudList, cloudRemove: cloudRemove
};
