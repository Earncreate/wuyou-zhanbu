const fs = require('fs');
const path = require('path');
const { JSDOM } = require('C:/Users/Yaojiawei/node_modules/jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('✓', name); }
  else { fail++; console.log('✗', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.com/' });
const { window } = dom;
const doc = window.document;

setTimeout(() => {
  // 元素与绑定
  ck('导出按钮存在', !!doc.getElementById('drawerExport'));
  ck('导入按钮存在', !!doc.getElementById('drawerImport'));
  ck('hidden file input 存在', !!doc.getElementById('importFile'));
  ck('mergeRecords 挂到 window', typeof window.mergeRecords === 'function');
  ck('store 封装可用', !!(window.__WY_STORE__ && window.__WY_STORE__.get));

  // mergeRecords 纯逻辑
  const cur = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];
  const inc = [{ id: 'b', v: 20 }, { id: 'c', v: 3 }];
  const m1 = window.mergeRecords(cur, inc, false);
  ck('合并按 id 去重', m1.length === 3 && m1.find(r => r.id === 'b').v === 20, m1.map(r => r.id + ':' + r.v));
  const m2 = window.mergeRecords(cur, inc, true);
  ck('覆盖=仅取入文件全量(替换原记录)', m2.length === 2 && m2.every(r => ['b', 'c'].includes(r.id)), m2.map(r => r.id));
  const big = []; for (let i = 0; i < 250; i++) big.push({ id: 'x' + i });
  ck('超 200 裁剪到 200', window.mergeRecords([], big, true).length === 200);

  // 预置一条记录并验证导出
  window.__WY_STORE__.set('wy_records', JSON.stringify([{ id: 'a', gua: '测试卦' }]));
  let createdA = null;
  const origCreate = doc.createElement.bind(doc);
  doc.createElement = function (t) {
    const el = origCreate(t);
    if (t === 'a') createdA = el;
    return el;
  };
  window.URL.createObjectURL = () => 'blob:mock';
  window.URL.revokeObjectURL = () => {};
  doc.getElementById('drawerExport').dispatchEvent(new window.Event('click'));
  ck('导出文件名含日期戳', createdA && /wyzb_records_\d{8}\.json/.test(createdA.download), createdA && createdA.download);

  // 导入：合并模式（confirm 返回 false）
  const payload = { app: 'wyzb', ver: 1, records: [{ id: 'n1', gua: '新卦1' }, { id: 'n2', gua: '新卦2' }] };
  const file = new window.File([JSON.stringify(payload)], 'imp.json', { type: 'application/json' });
  const input = doc.getElementById('importFile');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  window.confirm = () => false;
  input.dispatchEvent(new window.Event('change'));

  setTimeout(() => {
    const after = JSON.parse(window.__WY_STORE__.get('wy_records') || '[]');
    ck('导入合并含新 id n1/n2', after.some(r => r.id === 'n1') && after.some(r => r.id === 'n2'), after.map(r => r.id));
    ck('导入合并保留原有 a', after.some(r => r.id === 'a'), after.map(r => r.id));

    // 导入：覆盖模式
    const file2 = new window.File([JSON.stringify([{ id: 'z9', gua: '覆盖卦' }])], 'imp2.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file2], configurable: true });
    window.confirm = () => true;
    input.dispatchEvent(new window.Event('change'));
    setTimeout(() => {
      const after2 = JSON.parse(window.__WY_STORE__.get('wy_records') || '[]');
      ck('覆盖模式只剩导入的 z9', after2.length === 1 && after2[0].id === 'z9', after2.map(r => r.id));
      console.log('\n汇总：通过 ' + pass + '，失败 ' + fail);
      process.exit(fail ? 1 : 0);
    }, 60);
  }, 60);
}, 300);
