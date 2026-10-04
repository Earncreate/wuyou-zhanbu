/**
 * 云函数：liuyaoProxy
 * 作用：替小程序端转发大模型请求，API Key 只存在云端环境变量，不落到客户端。
 *
 * 部署前请在「云开发控制台 → 云函数 → liuyaoProxy → 配置 → 环境变量」里设置：
 *   LLM_BASE  接口地址，如 https://api.deepseek.com/v1
 *   LLM_KEY   API Key，如 sk-xxxx
 *   LLM_MODEL 默认模型（可选，客户端传了 model 以客户端为准）
 *
 * 说明：云函数无法向客户端流式推送，所以这里用非流式（stream:false）一次性返回全文。
 */
const https = require('https');

function postJSON(urlStr, headers, bodyObj) {
  return new Promise(function (resolve, reject) {
    var u;
    try { u = new URL(urlStr); } catch (e) { reject(new Error('接口地址不合法：' + urlStr)); return; }
    var data = JSON.stringify(bodyObj);
    var req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }, headers || {})
    }, function (res) {
      var buf = '';
      res.setEncoding('utf-8');
      res.on('data', function (d) { buf += d; });
      res.on('end', function () { resolve({ status: res.statusCode, body: buf }); });
    });
    req.on('error', reject);
    req.setTimeout(55000, function () { req.destroy(new Error('上游请求超时')); });
    req.write(data);
    req.end();
  });
}

exports.main = async function (event) {
  var base = process.env.LLM_BASE || '';
  var key = process.env.LLM_KEY || '';
  var defModel = process.env.LLM_MODEL || '';

  if (!base) return { ok: false, error: '云端未配置环境变量 LLM_BASE（接口地址）' };
  if (!key) return { ok: false, error: '云端未配置环境变量 LLM_KEY（API Key）' };

  var messages = event.messages;
  if (!Array.isArray(messages) || !messages.length) return { ok: false, error: 'messages 不能为空' };

  var model = event.model || defModel;
  if (!model) return { ok: false, error: '未指定模型（客户端未传且云端未配 LLM_MODEL）' };

  try {
    var r = await postJSON(
      String(base).replace(/\/+$/, '') + '/chat/completions',
      { 'Authorization': 'Bearer ' + key },
      {
        model: model,
        messages: messages,
        temperature: typeof event.temperature === 'number' ? event.temperature : 0.7,
        stream: false
      }
    );
    if (r.status !== 200) {
      return { ok: false, error: '上游返回 HTTP ' + r.status + '：' + String(r.body).slice(0, 200) };
    }
    var j;
    try { j = JSON.parse(r.body); } catch (e) { return { ok: false, error: '上游返回不是合法 JSON：' + String(r.body).slice(0, 200) }; }
    var content = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!content) return { ok: false, error: '上游返回内容为空' };
    return { ok: true, content: content };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
};
