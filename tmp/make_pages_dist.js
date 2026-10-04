#!/usr/bin/env node
/** 生成静态发布目录 dist/：只含 index.html + libs，并把后端地址写进 cloud.config.js
 *  用法：node tmp/make_pages_dist.js https://wyzb-sync.onrender.com
 *  不带参数则只打包，地址留空（纯离线模式，稍后在设置页手填也能用）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const api = (process.argv[2] || '').trim().replace(/\/+$/, '');

if (api && !/^https?:\/\//.test(api)) {
  console.error('地址必须以 http:// 或 https:// 开头');
  process.exit(1);
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'libs'), { recursive: true });

const files = ['lunar.js', 'liuyao.js', 'prompts.js', 'symbol_dict.js', 'config.js', 'app.css', 'cloud.config.js', 'api.js'];
for (const f of files) {
  const src = path.join(ROOT, 'libs', f);
  if (!fs.existsSync(src)) { console.error('缺少 libs/' + f); process.exit(1); }
  fs.copyFileSync(src, path.join(DIST, 'libs', f));
}
fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(DIST, 'index.html'));
// 管理员统计页（可选：root 登录后可看全站应验率与反馈明细）
if (fs.existsSync(path.join(ROOT, 'stats.html'))) {
  fs.copyFileSync(path.join(ROOT, 'stats.html'), path.join(DIST, 'stats.html'));
}

// 把后端地址烧进配置，部署后打开网页就不用手填
const cfgPath = path.join(DIST, 'libs', 'cloud.config.js');
let cfg = fs.readFileSync(cfgPath, 'utf8');
// 只替换行首那条真正的赋值，注释里的示例地址不算（^ 锚点 + m 多行）
cfg = cfg.replace(/^window\.WYZB_API_BASE\s*=\s*'[^']*';/m, "window.WYZB_API_BASE = '" + api + "';");
fs.writeFileSync(cfgPath, cfg);

const baked = /^window\.WYZB_API_BASE\s*=\s*'([^']*)';/m.exec(fs.readFileSync(cfgPath, 'utf8'));
if (!baked || baked[1] !== api) {
  console.error('烧入地址失败：期望 ' + JSON.stringify(api) + '，实际 ' + JSON.stringify(baked && baked[1]));
  process.exit(1);
}

console.log('已生成 ' + DIST);
console.log('后端地址：' + (api || '（未设置，纯离线模式）'));
console.log('把 dist/ 里的全部文件上传到 Cloudflare Pages / GitHub Pages / Vercel 即可');
