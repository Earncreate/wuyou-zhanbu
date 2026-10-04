var U = require('../../utils/common.js');

Page({
  data: {
    modId: '',
    mod: null,
    userText: '',
    coins: [{ i: 0, c: '', t: '字' }, { i: 1, c: '', t: '字' }, { i: 2, c: '', t: '字' }],
    dots: [{ n: '初', cls: '', mark: '' }, { n: '二', cls: '', mark: '' }, { n: '三', cls: '', mark: '' },
           { n: '四', cls: '', mark: '' }, { n: '五', cls: '', mark: '' }, { n: '上', cls: '', mark: '' }],
    tossing: false,
    tip: '心念既定，摇钱起卦',
    yaoMarks: [],
    plate: null
  },

  onLoad: function (opt) {
    var modId = opt.mod || 'diet';
    var m = U.CFG.MODULES[modId];
    var restore = opt.restore === '1';
    this.setData({
      modId: modId,
      askHolder: U.CFG.askPlaceholder(modId),
      mod: { name: m.name, icon: m.icon, sub: m.subtitle, desc: m.desc, color: m.color,
             ys: m.yongshen, yuan: m.yuanshen, ji: m.jishen, chou: m.choushen }
    });
    wx.setNavigationBarTitle({ title: m.name });

    if (restore) {
      var cur = getApp().globalData.current;
      if (cur && cur.chart) {
        var userText = cur.text || '';
        var dots = [], marks = [];
        (cur.raw || []).forEach(function (r, i) {
          dots[i] = {
            n: ['初', '二', '三', '四', '五', '上'][i],
            cls: r.sum === 9 ? 'yang mv' : (r.sum === 7 ? 'yang' : (r.sum === 6 ? 'yin mv' : 'yin')),
            mark: r.sum === 9 ? '○' : (r.sum === 6 ? '×' : '')
          };
          marks[i] = r.sum === 9 ? '○' : (r.sum === 6 ? '×' : '');
        });
        if (!dots.length) {
          dots = [{ n: '初', cls: '', mark: '' }, { n: '二', cls: '', mark: '' }, { n: '三', cls: '', mark: '' },
                  { n: '四', cls: '', mark: '' }, { n: '五', cls: '', mark: '' }, { n: '上', cls: '', mark: '' }];
        }
        this.setData({
          userText: userText, plate: U.toPlate(cur.chart), dots: dots, yaoMarks: marks,
          tip: '成卦：' + cur.chart.ben.name
        });
      }
    }
  },

  onAskInput: function (e) {
    this.setData({ userText: e.detail.value });
  },

  onToss: function () {
    if (this.data.tossing) return;
        var self = this;
        self.setData({ tossing: true, plate: null, yaoMarks: [], tip: '正在摇第 1 爻…' });
        self.setData({ dots: [{ n: '初', cls: '', mark: '' }, { n: '二', cls: '', mark: '' }, { n: '三', cls: '', mark: '' }, { n: '四', cls: '', mark: '' }, { n: '五', cls: '', mark: '' }, { n: '上', cls: '', mark: '' }] });

    var step = 0;
    function next() {
      if (step >= 6) {
        self.setData({ tossing: false, coins: [{ i: 0, c: '', t: '字' }, { i: 1, c: '', t: '字' }, { i: 2, c: '', t: '字' }] });
        self._finish(raw);
        return;
      }
      self.setData({
        coins: [{ i: 0, c: 'rolling', t: '字' }, { i: 1, c: 'rolling', t: '字' }, { i: 2, c: 'rolling', t: '字' }],
        tip: '正在摇第 ' + (step + 1) + ' 爻…'
      });
      setTimeout(function () {
        var r = U.LY.tossOnce();
        raw.push(r);
        var coins = r.coins.map(function (c, ci) {
          return { i: ci, c: c === 3 ? 'back' : '', t: c === 3 ? '背' : '字' };
        });
        var dots = self.data.dots.map(function (d) { return { n: d.n, cls: d.cls, mark: d.mark }; });
        var marks = self.data.yaoMarks.slice();
        dots[step].cls = r.sum === 9 ? 'yang mv' : (r.sum === 7 ? 'yang' : (r.sum === 6 ? 'yin mv' : 'yin'));
        marks[step] = r.sum === 9 ? '○' : (r.sum === 6 ? '×' : '');
        self.setData({ coins: coins, dots: dots, yaoMarks: marks });
        step++;
        setTimeout(next, 260);
      }, 620);
    }
    next();
  },

  _finish: function (raw) {
    var g = U.nowGanzhi();
    var chart = U.arrange(raw, g);
    var app = getApp();
    app.globalData.current = { moduleId: this.data.modId, text: this.data.userText, chart: chart, raw: raw, beijing: g.beijing };
    app.globalData.aiResult = null;
    this.setData({ plate: U.toPlate(chart), tip: '成卦：' + chart.ben.name });
  },

  onReset: function () {
    this.setData({
      dots: [{ n: '初', cls: '', mark: '' }, { n: '二', cls: '', mark: '' }, { n: '三', cls: '', mark: '' },
             { n: '四', cls: '', mark: '' }, { n: '五', cls: '', mark: '' }, { n: '上', cls: '', mark: '' }],
      yaoMarks: [], plate: null, tip: '心念既定，摇钱起卦',
      coins: [{ i: 0, c: '', t: '字' }, { i: 1, c: '', t: '字' }, { i: 2, c: '', t: '字' }]
    });
  },

  goResult: function () {
    if (!this.data.plate) return;
    wx.navigateTo({ url: '/pages/result/result' });
  },

  goSetting: function () {
    wx.navigateTo({ url: '/pages/setting/setting' });
  }
});
