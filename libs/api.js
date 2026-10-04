/* 云同步客户端：登录 / 注册(邀请码) / 占卜记录多端同步 / 大模型 Key 云端保管。
 *
 * 设计底线：未配置 WYZB_API_BASE 时整套逻辑空转，纯离线用法与以前完全一样。
 * 传输层同时兼容浏览器 fetch 与微信小程序 wx.request，web 与小程序共用这一份文件。
 */
(function () {
  var IS_WX = (typeof wx !== 'undefined') && typeof wx.request === 'function';

  function S() { return (typeof window !== 'undefined') ? window.__WY_STORE__ : null; }
  var MEM = {};
  function sget(k) {
    var s = S();
    if (s) return s.get(k);
    if (IS_WX) { try { return wx.getStorageSync(k) || null; } catch (e) { } }
    return (k in MEM) ? MEM[k] : null;
  }
  function sset(k, v) {
    var s = S();
    if (s) return s.set(k, v);
    if (IS_WX) { try { wx.setStorageSync(k, String(v)); return true; } catch (e) { } }
    MEM[k] = String(v); return true;
  }
  function sdel(k) {
    var s = S();
    if (s) return s.remove(k);
    if (IS_WX) { try { wx.removeStorageSync(k); } catch (e) { } }
    delete MEM[k];
  }
  function jget(k, def) {
    try { var v = JSON.parse(sget(k) || 'null'); return v == null ? def : v; } catch (e) { return def; }
  }
  function jset(k, v) { try { sset(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  function base() {
    var b = '';
    if (typeof window !== 'undefined' && window.WYZB_API_BASE) b = window.WYZB_API_BASE;
    b = b || sget('wy_api_base') || '';
    return String(b).trim().replace(/\/+$/, '');
  }
  function enabled() { return !!base(); }
  function token() { return sget('wy_token') || ''; }
  function authed() { return enabled() && !!token(); }
  function user() { return sget('wy_user') || ''; }

  // ---------- 传输层 ----------
  function http(path, opts) {
    opts = opts || {};
    var url = base() + path;
    var method = (opts.method || 'GET').toUpperCase();
    var headers = { 'Content-Type': 'application/json' };
    if (token()) headers['Authorization'] = 'Bearer ' + token();
    if (opts.headers) for (var h in opts.headers) headers[h] = opts.headers[h];
    var body = opts.body ? JSON.stringify(opts.body) : undefined;

    // 登录接口自己的 401 是「密码错」，不是「token 过期」，别在这登出、也别谎报过期
    var isAuthEndpoint = path.indexOf('/api/auth/login') === 0;
    function bad(j, status) {
      var msg = (j && (j.detail || j.message));
      if (msg && typeof msg !== 'string') msg = JSON.stringify(msg);
      return new Error(msg || ('HTTP ' + status));
    }
    if (IS_WX) {
      return new Promise(function (resolve, reject) {
        wx.request({
          url: url, method: method, header: headers, data: body ? JSON.parse(body) : undefined,
          dataType: 'json',
          success: function (r) {
            var j = r.data || {};
            if (r.statusCode === 401 && !isAuthEndpoint) { logout(); reject(new Error('登录已过期，请重新登录')); return; }
            if (r.statusCode >= 400) { reject(bad(j, r.statusCode)); return; }
            resolve(j);
          },
          fail: function (e) { reject(new Error((e && e.errMsg) || '网络请求失败')); }
        });
      });
    }
    return fetch(url, { method: method, headers: headers, body: body }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && !isAuthEndpoint) { logout(); throw new Error('登录已过期，请重新登录'); }
        if (!r.ok) throw bad(j, r.status);
        return j;
      });
    });
  }

  // ---------- 账号 ----------
  function login(u, p) {
    return http('/api/auth/login', { method: 'POST', body: { username: u, password: p } })
      .then(function (j) {
        sset('wy_token', j.token); sset('wy_user', j.username);
        return j;
      });
  }
  function register(u, p, code, nick) {
    return http('/api/auth/register', { method: 'POST', body: { username: u, password: p, invite_code: code || '', nickname: nick || '' } })
      .then(function (j) {
        sset('wy_token', j.token); sset('wy_user', j.username);
        return j;
      });
  }
  function logout() { sdel('wy_token'); sdel('wy_user'); sset('wy_sync_ts', '0'); }
  function me() { return http('/api/auth/me'); }
  function changePassword(oldp, newp) {
    return http('/api/auth/password', { method: 'POST', body: { old: oldp, new: newp } });
  }

  // ---------- 管理员：生成邀请码（默认只有 root 能用） ----------
  function createInvites(count, code) {
    var q = '/api/admin/invites?count=' + (count || 1) + (code ? '&code=' + encodeURIComponent(code) : '');
    return http(q, { method: 'POST' });
  }
  function listInvites() { return http('/api/admin/invites'); }

  // ---------- 应验统计 ----------
  // 本人：只看自己的准头；管理员：全站汇总与反馈明细（服务端按 token 鉴权，非 root 拿 403）
  function myStats() { return http('/api/records/stats'); }
  function adminStats() { return http('/api/admin/stats'); }
  function adminFeedback(opt) {
    opt = opt || {};
    var q = '/api/admin/feedback?limit=' + (opt.limit || 50) + '&offset=' + (opt.offset || 0);
    if (opt.level) q += '&level=' + opt.level;
    if (opt.username) q += '&username=' + encodeURIComponent(opt.username);
    return http(q);
  }
  function rawGet(pathname) { return http(pathname); }

  // ---------- 待同步队列 ----------
  // 只记 id/时间戳/删除标记，payload 在同步瞬间从本地列表取，避免把大文本重复写进存储
  function pending() { return jget('wy_pending', []); }
  function markDirty(rec, deleted) {
    if (!rec || !rec.id) return;
    var p = pending().filter(function (x) { return x.id !== rec.id; });
    p.push({ id: rec.id, updatedAt: rec.updatedAt || rec.createdAt || Date.now(), deleted: !!deleted });
    if (p.length > 300) p = p.slice(-300);
    jset('wy_pending', p);
  }
  function clearPending() { jset('wy_pending', []); }

  // ---------- 记录同步 ----------
  function buildChanges(localList) {
    var idx = {};
    (localList || []).forEach(function (r) { if (r && r.id) idx[r.id] = r; });
    return pending().map(function (p) {
      var r = idx[p.id] || {};
      return { id: p.id, updatedAt: p.updatedAt || Date.now(), deleted: !!p.deleted, payload: p.deleted ? {} : r };
    });
  }
  function sync(localList) {
    if (!authed()) return Promise.resolve(null);
    var body = { since: +(sget('wy_sync_ts') || 0), changes: buildChanges(localList) };
    return http('/api/records/sync', { method: 'POST', body: body }).then(function (j) {
      var map = {};
      (localList || []).forEach(function (r) { if (r && r.id) map[r.id] = r; });
      (j.records || []).forEach(function (x) {
        if (x.deleted) { delete map[x.id]; return; }
        var remote = x.payload || {}; remote.id = x.id;
        var cur = map[x.id];
        // 冲突规则：时间戳大的赢，跟服务端保持一致
        if (!cur || (x.updatedAt || 0) >= (cur.updatedAt || cur.createdAt || 0)) map[x.id] = remote;
      });
      var merged = Object.keys(map).map(function (k) { return map[k]; });
      merged.sort(function (a, b) { return (b.createdAt || b.updatedAt || 0) - (a.createdAt || a.updatedAt || 0); });
      if (merged.length > 200) merged = merged.slice(0, 200);
      sset('wy_sync_ts', String(j.serverTime || Date.now()));
      clearPending();
      return { merged: merged, pulled: (j.records || []).length, pushed: j.applied || 0 };
    });
  }
  function wipeRemote() {
    if (!authed()) return Promise.resolve(null);
    return http('/api/records', { method: 'DELETE' }).then(function () { sset('wy_sync_ts', '0'); return true; });
  }

  // ---------- 大模型 Key（服务端加密保管） ----------
  function getKey() { return http('/api/keys'); }
  function putKey(b, m, k) { return http('/api/keys', { method: 'PUT', body: { base: b, model: m, key: k } }); }
  function dropKey() { return http('/api/keys', { method: 'PUT', body: { key: '' } }); }

  // ---------- 服务端代理调用大模型（浏览器不接触 Key） ----------
  function llmChat(messages, temperature, onDelta) {
    var body = { messages: messages, temperature: temperature == null ? 0.7 : temperature };
    var url = base() + '/api/llm/chat';
    var headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() };
    if (IS_WX) {
      return new Promise(function (resolve, reject) {
        wx.request({
          url: url, method: 'POST', header: headers, data: body, dataType: 'json',
          success: function (r) {
            if (r.statusCode >= 400) { reject(new Error((r.data && (r.data.detail || r.data.message)) || ('HTTP ' + r.statusCode))); return; }
            resolve(r.data);
          },
          fail: function (e) { reject(new Error((e && e.errMsg) || '网络请求失败')); }
        });
      });
    }
    return fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body) }).then(function (res) {
      if (res.status === 401) { logout(); throw new Error('登录已过期，请重新登录'); }
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          throw new Error((j && (j.detail || j.message)) || ('HTTP ' + res.status));
        });
      }
      if (!res.body) throw new Error('当前浏览器不支持流式响应');
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
            if (!payload || payload === '[DONE]') return;
            try {
              var j = JSON.parse(payload);
              if (j.error && j.error.message) throw new Error(j.error.message);
              var d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
              if (d) { acc += d; if (onDelta) onDelta(acc); }
            } catch (e) { if (e && e.message && e.message.indexOf('上游') === 0) throw e; }
          });
          return pump();
        });
      })();
    });
  }

  var API = {
    IS_WX: IS_WX,
    base: base, enabled: enabled, setBase: function (u) { sset('wy_api_base', String(u || '').trim().replace(/\/+$/, '')); },
    token: token, user: user, authed: authed,
    login: login, register: register, logout: logout, me: me, changePassword: changePassword,
    createInvites: createInvites, listInvites: listInvites,
    myStats: myStats, adminStats: adminStats, adminFeedback: adminFeedback, rawGet: rawGet,
    pending: pending, markDirty: markDirty, clearPending: clearPending, buildChanges: buildChanges,
    sync: sync, wipeRemote: wipeRemote,
    getKey: getKey, putKey: putKey, dropKey: dropKey,
    llmChat: llmChat
  };

  if (typeof window !== 'undefined') window.WYCloud = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
