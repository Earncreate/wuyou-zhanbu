// 云函数 liuyaoProxy 本地冒烟测试（不依赖微信环境，只验证参数校验与错误处理）
var path = require('path');
var fn = require(path.join(__dirname, '..', 'cloudfunctions', 'liuyaoProxy', 'index.js'));

var pass = 0, fail = 0;
function check(name, cond, got) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + ' → ' + JSON.stringify(got)); }
}

(async function () {
  // 1. 未配置环境变量
  delete process.env.LLM_BASE; delete process.env.LLM_KEY; delete process.env.LLM_MODEL;
  var r1 = await fn.main({ messages: [{ role: 'user', content: 'hi' }], model: 'm' });
  check('未配 LLM_BASE 时明确报错', r1.ok === false && /LLM_BASE/.test(r1.error), r1);

  // 2. 配了 BASE 没配 KEY
  process.env.LLM_BASE = 'https://api.deepseek.com/v1';
  var r2 = await fn.main({ messages: [{ role: 'user', content: 'hi' }], model: 'm' });
  check('未配 LLM_KEY 时明确报错', r2.ok === false && /LLM_KEY/.test(r2.error), r2);

  // 3. messages 为空
  process.env.LLM_KEY = 'sk-test';
  var r3 = await fn.main({ messages: [], model: 'm' });
  check('messages 为空时报错', r3.ok === false && /messages/.test(r3.error), r3);
  var r3b = await fn.main({ model: 'm' });
  check('messages 缺失时报错', r3b.ok === false && /messages/.test(r3b.error), r3b);

  // 4. 未指定模型
  var r4 = await fn.main({ messages: [{ role: 'user', content: 'hi' }] });
  check('未指定模型时报错', r4.ok === false && /模型/.test(r4.error), r4);

  // 5. 接口地址不可达时应被 catch 住并返回 ok:false（不抛异常）
  process.env.LLM_BASE = 'https://127.0.0.1:9/none';
  var r5 = await fn.main({ messages: [{ role: 'user', content: 'hi' }], model: 'm' });
  check('上游不可达时捕获异常不崩溃', r5.ok === false && typeof r5.error === 'string', r5);

  console.log('\n云函数冒烟: 通过 ' + pass + ' 项, 失败 ' + fail + ' 项');
  process.exit(fail ? 1 : 0);
})();
