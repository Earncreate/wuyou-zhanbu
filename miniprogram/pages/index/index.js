var U = require('../../utils/common.js');

Page({
  data: {
    gz: '',
    mods: [],
    groups: []
  },
  onLoad: function () {
    var g = U.nowGanzhi();
    var CFG = U.CFG;
    var modGroups = CFG.MOD_GROUPS.map(function (grp) {
      return {
        key: grp.key, name: grp.name,
        mods: grp.ids.map(function (id) {
          var m = CFG.MODULES[id];
          return { id: id, name: m.name, icon: m.icon, sub: m.subtitle, desc: m.desc, color: m.color, color2: m.color2 };
        })
      };
    });
    this.setData({ modGroups: modGroups, gz: g.ganzhiYear + '年 · 月建' + g.month + ' · 日辰' + g.day + ' · ' + g.jieqi });
  },
  onShow: function () {
    var self = this;
    var all = U.getRecords();
    var items = all.map(function (r, i) {
      return { kind: 'local', idx: i, cloudId: r.cloudId || '', rec: r };
    });

    function toRow(it) {
      var r = it.rec;
      var six = r.six || (r.chart && r.chart.ben && r.chart.ben.six) || [];
      // 阳历日期 与 北京时间 分开显示（不含星期）
      var bj = r.beijing || '';
      var bm = bj.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/);
      var solarRaw = r.solar ? String(r.solar).replace(/^公历\s*/, '') : '';
      return {
        kind: it.kind, idx: it.idx, cloudId: it.cloudId || '',
        key: it.kind + '_' + (it.cloudId || it.idx),
        gua: r.gua || (r.chart && r.chart.ben && r.chart.ben.name) || '',
        ask: r.text || '（未填写）',
        solarTxt: solarRaw || (bm ? (bm[1] + '-' + bm[2] + '-' + bm[3]) : ''),
        bjTxt: bm ? (bm[4] + ' 北京时间') : (bj || ''),
        hasAi: !!r.aiFinal,
        fig: six.slice().reverse().map(function (b, fi) { return { yang: !!b, i: fi }; })
      };
    }

    function render() {
      var CFG = U.CFG;
      var order = [];
      CFG.MOD_GROUPS.forEach(function (g) { g.ids.forEach(function (id) { order.push(id); }); });
      var ids = [];
      items.forEach(function (it) {
        var mid = it.rec.moduleId;
        if (mid && ids.indexOf(mid) < 0) ids.push(mid);
      });
      ids.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
      var groups = ids.map(function (id) {
        var m = CFG.MODULES[id] || { name: id, icon: '🎲', color: '#888780' };
        var recs = items.filter(function (it) { return it.rec.moduleId === id; })
          .sort(function (a, b) { return (b.rec.createdAt || 0) - (a.rec.createdAt || 0); })
          .map(toRow);
        return { id: id, name: m.name, icon: m.icon, color: m.color, recs: recs };
      });
      self.setData({ groups: groups, cloudOn: U.cloudEnabled() });
    }

    render();

    // 云端记录合并：本地没有的（换设备/清缓存后）从云端补回
    if (U.cloudEnabled()) {
      U.cloudList().then(function (docs) {
        var localIds = {};
        all.forEach(function (r) { if (r.id) localIds[r.id] = 1; });
        docs.forEach(function (d) {
          if (d.localId && localIds[d.localId]) return; // 本地已有，避免重复
          items.push({
            kind: 'cloud', idx: -1, cloudId: d._id,
            rec: {
              id: d.localId || '', moduleId: d.moduleId, text: d.ask || '',
              gua: d.gua || '', solar: d.solar || '', beijing: d.beijing || '',
              six: d.six || [], chart: d.chart || null, raw: null,
              aiFinal: d.aiFinal || '', createdAt: d.createdAt || 0
            }
          });
        });
        render();
      }).catch(function () { }); // 云端不可达时仅显示本地
    }
  },
  onMod: function (e) {
    wx.navigateTo({ url: '/pages/divination/divination?mod=' + e.currentTarget.dataset.mod });
  },
  goSet: function () {
    wx.navigateTo({ url: '/pages/setting/setting' });
  },
  onRecord: function (e) {
    var kind = e.currentTarget.dataset.kind || 'local';
    var idx = +e.currentTarget.dataset.idx;
    var rec;
    if (kind === 'local') {
      rec = U.getRecords()[idx];
    } else {
      // 纯云端记录：从当前分组数据里取
      var cid = e.currentTarget.dataset.cloud || '';
      this.data.groups.forEach(function (g) {
        g.recs.forEach(function (r) { if (r.cloudId === cid) rec = r.rec; });
      });
    }
    if (!rec || !rec.chart) {
      wx.showToast({ title: '该记录缺少卦象数据，无法还原', icon: 'none' });
      return;
    }
    var app = getApp();
    app.globalData.current = { moduleId: rec.moduleId, text: rec.text, chart: rec.chart, raw: rec.raw || [], beijing: rec.beijing || '' };
    app.globalData.aiResult = rec.aiFinal ? { stage1: rec.aiStage1 || '', final: rec.aiFinal } : null;
    wx.navigateTo({ url: '/pages/divination/divination?mod=' + rec.moduleId + '&restore=1' });
  },
  clearRecords: function () {
    var self = this;
    var on = U.cloudEnabled();
    wx.showModal({
      title: '清空记录', content: '将删除本机全部起卦记录' + (on ? '，并同步删除云端记录' : '') + '，确定吗？',
      success: function (r) {
        if (!r.confirm) return;
        wx.setStorageSync('wy_records', []);
        if (on) {
          U.cloudList().then(function (docs) {
            docs.forEach(function (d) { U.cloudRemove(d._id).catch(function () { }); });
          }).catch(function () { });
        }
        self.onShow();
      }
    });
  },
  onDelete: function (e) {
    var self = this;
    var kind = e.currentTarget.dataset.kind || 'local';
    var idx = +e.currentTarget.dataset.idx;
    var cloudId = e.currentTarget.dataset.cloud || '';
    wx.showModal({
      title: '删除记录',
      content: cloudId ? '本地与云端都会删除这条记录，确定吗？' : '确定删除这条记录吗？',
      success: function (r) {
        if (!r.confirm) return;
        if (kind === 'local' && idx >= 0) U.deleteRecord(idx);
        if (cloudId && U.cloudEnabled()) U.cloudRemove(cloudId).catch(function () { });
        self.onShow();
      }
    });
  }
});
