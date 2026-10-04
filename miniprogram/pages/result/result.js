var U = require('../../utils/common.js');

Page({
  data: {
    hasKey: false,
    ctx: null,
    modName: '',
    stage: 0,        // 0未开始 1第一段 2第二段 3完成
    out: '',
    stage1: '',
    foldOpen: false,
    err: null,
    running: false,
    saved: false,
    savedId: '',
    cloudOn: false
  },

  onLoad: function () {
    var app = getApp();
    var cur = app.globalData.current;
    if (!cur || !cur.chart) {
      wx.showToast({ title: '请先起卦', icon: 'none' });
      setTimeout(function () { wx.navigateBack(); }, 1000);
      return;
    }
    var m = U.CFG.MODULES[cur.moduleId];
    var c = cur.chart;
    this.setData({
      modName: m.name,
      hasKey: U.hasKey(),
      ctx: {
        icon: m.icon, modName: m.name,
        askText: U.CFG.situationText(cur.text),
        gua: c.ben.name + (c.bian ? ' 之 ' + c.bian.name : ''),
        palace: c.ben.info.palaceName,
        shiYing: '世' + c.ben.info.shi + '应' + c.ben.info.ying,
        solar: c.solarText, lunar: c.lunarText,
        yueJian: c.monthGanZhi, riChen: c.dayGanZhi
      }
    });

    var saved = app.globalData.aiResult;
    if (saved && saved.final) {
      this.setData({ stage: 3, out: saved.final, stage1: saved.stage1 });
    } else if (U.hasKey()) {
      this.runTwoStage();
    }
  },

  runTwoStage: function () {
    var self = this;
    var app = getApp();
    var cur = app.globalData.current;
    if (!U.hasKey()) { wx.showToast({ title: '请先在设置页完成配置', icon: 'none' }); return; }

    self.setData({ running: true, err: null, out: '', stage1: '', stage: 1, foldOpen: false });

    U.callLLMAuto(U.CFG.buildStage1Messages(cur.moduleId, cur.text, cur.chart), null)
      .then(function (t1) {
        self.setData({ stage1: t1, stage: 2, out: '' });
        // 轴锁：Stage2 走带校验重试的通道（用神轴反置则重试一次，仍错则显式标注）
        return U.CFG.runStage2Guarded(function (msgs, onDelta) {
          return U.callLLMAuto(msgs, onDelta);
        }, {
          modId: cur.moduleId, userText: cur.text, chart: cur.chart, stage1Text: t1,
          onDelta: function (acc) { self.setData({ out: acc }); },
          onRetry: function (chk) { self.setData({ out: '（用神轴校验未通过：' + chk.reason + '，正在重试纠正…）' }); }
        }).then(function (r) {
          self.axisCheck = { ok: r.axisOk, reason: r.axisReason, attempts: r.attempts };
          return r.text;
        });
      })
      .then(function (t2) {
        app.globalData.aiResult = { stage1: self.data.stage1, final: t2 };
        self.setData({ stage: 3, out: t2, running: false });
        // 若此前已点过保存，把解读补写进本地记录与云端
        if (self.data.savedId) {
          var patch = { aiFinal: t2, aiStage1: self.data.stage1 };
          var r = U.updateRecordById(self.data.savedId, patch);
          if (r && r.cloudId && U.cloudEnabled()) {
            U.cloudUpdate(r.cloudId, patch).catch(function () { });
          }
        }
      })
      .catch(function (e) {
        self.setData({ err: e.message || String(e), running: false, stage: 0 });
      });
  },

  toggleFold: function () { this.setData({ foldOpen: !this.data.foldOpen }); },
  retry: function () { this.runTwoStage(); },
  goSetting: function () { wx.navigateTo({ url: '/pages/setting/setting' }); },
  copy: function () {
    wx.setClipboardData({ data: this.data.out || '' });
  },
  save: function () {
    if (this.data.saved) return;
    var app = getApp();
    var cur = app.globalData.current;
    if (!cur || !cur.chart) return;
    var m = U.CFG.MODULES[cur.moduleId];
    var c = cur.chart;
    var id = U.newId();
    var rec = {
      id: id,
      moduleId: cur.moduleId, modName: m.name,
      text: cur.text || '',
      gua: c.ben.name + (c.bian ? ' 之 ' + c.bian.name : ''),
      six: c.ben.six,
      solar: c.solarText,
      beijing: cur.beijing || U.beijingTime(),
      chart: c, raw: cur.raw,
      aiFinal: this.data.out || '',
      aiStage1: this.data.stage1 || '',
      createdAt: Date.now()
    };
    U.saveRecord(rec);
    this.setData({ saved: true, savedId: id });
    // 云端同步：失败也不影响本地已保存
    if (U.cloudEnabled()) {
      U.cloudAdd(rec).then(function (cid) {
        U.updateRecordById(id, { cloudId: cid });
      }).catch(function () { });
    }
    wx.showToast({ title: '已存入「' + m.name + '」记录', icon: 'success' });
  }
});
