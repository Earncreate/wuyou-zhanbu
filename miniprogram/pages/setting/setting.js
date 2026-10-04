var U = require('../../utils/common.js');

var PRESETS = [
  { label: 'DeepSeek（推荐）', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { label: '阿里云百炼 · 通义', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { label: '智谱 GLM', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { label: '硅基流动', base: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-72B-Instruct' },
  { label: '本地 / 自建网关', base: '', model: '' }
];

Page({
  data: {
    presetNames: PRESETS.map(function (p) { return p.label; }),
    presetIndex: 0,
    base: '', model: '', key: '',
    cloudEnv: '', useCloud: false,
    state: ''
  },

  onLoad: function () {
    var base = wx.getStorageSync('wy_base') || PRESETS[0].base;
    var model = wx.getStorageSync('wy_model') || PRESETS[0].model;
    var key = wx.getStorageSync('wy_key') || '';
    var cloudEnv = wx.getStorageSync('wy_cloud_env') || '';
    var useCloud = wx.getStorageSync('wy_use_cloud') === '1';
    var idx = 0;
    PRESETS.forEach(function (p, i) { if (p.base === base) idx = i; });
    if (base && idx === 0 && base !== PRESETS[0].base) idx = PRESETS.length - 1;
    this.setData({ base: base, model: model, key: key, cloudEnv: cloudEnv, useCloud: useCloud, presetIndex: idx });
    this._state();
  },

  _state: function () {
    var c = U.getCfg();
    if (c.useCloud) {
      this.setData({ state: c.cloudEnv ? '云代理模式 · 环境 ' + c.cloudEnv + ' · Key 存于云端' : '云代理模式 · 尚未填写云环境 ID' });
      return;
    }
    this.setData({ state: c.key ? '直连模式 · 已配置 ' + (c.model || '') : '未配置，需填写后才能在解析页调用' });
  },

  onCloudEnv: function (e) { this.setData({ cloudEnv: e.detail.value }); },
  onUseCloud: function (e) { this.setData({ useCloud: e.detail.value }); this._state(); },

  onPreset: function (e) {
    var i = +e.detail.value;
    var p = PRESETS[i];
    this.setData({ presetIndex: i, base: p.base, model: p.model });
  },
  onBase: function (e) { this.setData({ base: e.detail.value }); },
  onModel: function (e) { this.setData({ model: e.detail.value }); },
  onKey: function (e) { this.setData({ key: e.detail.value }); },

  save: function () {
    var b = (this.data.base || '').trim();
    var m = (this.data.model || '').trim();
    var k = (this.data.key || '').trim();
    var env = (this.data.cloudEnv || '').trim();
    var useCloud = !!this.data.useCloud;

    if (useCloud && !env) {
      wx.showToast({ title: '云代理模式需填写云环境 ID', icon: 'none' });
      return;
    }
    if (!useCloud && !b.startsWith('http')) {
      wx.showToast({ title: '请填写以 http 开头的接口地址', icon: 'none' });
      return;
    }
    wx.setStorageSync('wy_base', b);
    wx.setStorageSync('wy_model', m);
    wx.setStorageSync('wy_key', k);
    wx.setStorageSync('wy_cloud_env', env);
    wx.setStorageSync('wy_use_cloud', useCloud ? '1' : '0');
    if (useCloud && env && wx.cloud && wx.cloud.init) {
      try { wx.cloud.init({ env: env, traceUser: true }); } catch (e) { }
    }
    this._state();
    wx.showToast({ title: useCloud ? '已保存（云代理）' : (k ? '已保存' : '已保存（Key 为空）'), icon: 'none' });
  },

  test: function () {
    var self = this;
    var useCloud = !!this.data.useCloud;
    var msgs = [
      { role: 'system', content: '你是一个连通性测试助手。' },
      { role: 'user', content: '只回复两个字：正常' }
    ];
    var p;
    if (useCloud) {
      if (!wx.cloud || !wx.cloud.callFunction) {
        wx.showModal({ title: '无法测试', content: '当前环境不支持云开发，请改用直连模式', showCancel: false });
        return;
      }
      wx.showLoading({ title: '测试中' });
      p = U.callLLMViaCloud(msgs, { model: (self.data.model || '').trim() }, null);
    } else {
      var cfg = { base: (this.data.base || '').trim(), model: (this.data.model || '').trim(), key: (this.data.key || '').trim() };
      if (!cfg.key) { wx.showToast({ title: '请先填写 Key', icon: 'none' }); return; }
      wx.showLoading({ title: '测试中' });
      p = U.callLLM(msgs, cfg, null);
    }
    p.then(function (t) {
      wx.hideLoading();
      wx.showModal({ title: '连通成功', content: '返回：' + String(t).slice(0, 60), showCancel: false });
    }).catch(function (e) {
      wx.hideLoading();
      wx.showModal({ title: '连通失败', content: e.message || String(e), showCancel: false });
    });
  },

  clear: function () {
    var self = this;
    wx.showModal({
      title: '清除配置', content: '将删除本机保存的接口地址、模型、Key 与云代理配置。',
      success: function (r) {
        if (!r.confirm) return;
        wx.removeStorageSync('wy_base'); wx.removeStorageSync('wy_model'); wx.removeStorageSync('wy_key');
        wx.removeStorageSync('wy_cloud_env'); wx.removeStorageSync('wy_use_cloud');
        self.setData({ key: '', cloudEnv: '', useCloud: false }); self._state();
      }
    });
  }
});
