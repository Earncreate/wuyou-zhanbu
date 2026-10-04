App({
  globalData: {
    current: null, // { moduleId, text, chart, raw }
    aiResult: null // { stage1, final }
  },
  onLaunch: function () {
    var s = wx.getStorageSync('wy_base');
    if (!s) {
      wx.setStorageSync('wy_base', 'https://api.deepseek.com/v1');
      wx.setStorageSync('wy_model', 'deepseek-chat');
    }
    // 仅在填了云环境 ID 且开启云代理时才初始化云开发，避免未开通云开发时报错
    var env = wx.getStorageSync('wy_cloud_env') || '';
    if (env && wx.cloud && wx.cloud.init) {
      try { wx.cloud.init({ env: env, traceUser: true }); } catch (e) { }
    }
  }
});
