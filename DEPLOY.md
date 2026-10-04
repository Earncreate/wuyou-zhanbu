# 上线部署清单（0 元档）

当前进度：数据库已建好并验证通过，只差 Render 建服务 + 前端上传。

| 环节 | 平台 | 状态 |
| --- | --- | --- |
| 数据库 Postgres | Supabase 免费档 | ✅ 已建表、已写入 root/user 与 5 个邀请码 |
| 后端 FastAPI | Render 免费档 | ⬜ 待建（下一步） |
| 前端静态站 | Cloudflare Pages / GitHub Pages / Vercel | ⬜ 待传（拿到后端域名后） |
| 大模型 | 用户自带 Key | ✅ 无需配置 |

---

## 一、后端：Render（免费档）

1. 把代码推到 GitHub（Render 从仓库拉代码；`server/.env` 已在 .gitignore 里，不会泄露数据库密码）。
2. 打开 Render → New → Blueprint，选这个仓库，它会读 `server/render.yaml` 自动建服务。
   - 若 Render 没找到 Blueprint 文件，就手动 New → Web Service，填这些：
     - Runtime: Python 3
     - Build Command: `pip install -r requirements.txt`
     - Start Command: `cd server && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
     - Region: Singapore（离数据库近）
     - Health Check Path: `/api/health`
3. **环境变量**（Dashboard → Environment）：

| Key | 值 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 直接复制本地 `server/.env` 里 `DATABASE_URL=` 后面那一整行（形如 `postgresql://postgres.<项目id>:<密码>@aws-0-<区>.pooler.supabase.com:5432/postgres`） | 不要勾「Sync to repo」 |
| `SECRET_KEY` | 必须与本地 `server/.env` 里的值**完全一致** | 本地与线上共用同一个库，两边不一致会让库里已加密的 API Key 解不开 |
| `ALLOWED_ORIGINS` | 先填 `*`，前端域名确定后改成 `https://你的前端域名` | |
| `PYTHON_VERSION` | `3.12.4` | |

4. Deploy 完成后访问 `https://你的服务名.onrender.com/api/health`，返回 `{"ok":true,...}` 即成功。
   把 `https://你的服务名.onrender.com` 这个地址记下来，下一步要用。

### 建好后要做的两件事
- **改密码**：root 和 user 的初始密码太弱，登录后立刻改（`POST /api/auth/password`）。
- **保活**：Render 免费档 15 分钟无访问会休眠，首次打开要等 30–50 秒。用 UptimeRobot 每 10 分钟打一次 `/api/health` 即可常驻。

---

## 二、前端：Cloudflare Pages（推荐，国内访问快）

拿到后端域名后，在本地跑一条命令重新打包（把后端地址烧进页面）：

```bash
node tmp/make_pages_dist.js https://你的服务名.onrender.com
```

然后把生成的 `dist/` 整个目录上传：
- Cloudflare Pages → Create → Upload assets，选 dist 文件夹，得到 `xxx.pages.dev`；
- 或 GitHub Pages / Vercel，同样是传 `dist/`，无需构建。

不需要买域名，平台给的免费子域名直接能用。手机浏览器打开 →「添加到主屏幕」即可当 App 用。

---

## 三、验证上线是否成功

1. 打开前端网址 → 设置页 → 账号卡片 → 用 `root` 登录。能登录说明前后端与数据库全通。
2. 起一卦 → 解析 → 点一个应验等级 → 换一台设备（或浏览器无痕窗口）登录同一账号，能看到这条记录和反馈，说明云同步正常。
3. 访问 `https://你的前端域名/stats.html`，用 root 登录，能看到全站统计与反馈明细。

---

## 四、已知限制（免费档的代价）

- **Supabase 免费项目连续 7 天无访问会被暂停**，届时打开会报错，去面板点 Restore 即可恢复（数据不丢）。
- **Render 免费档休眠**：见上面保活方案。Koyeb 免费档不休眠，但同样没有持久盘，数据库依然要外挂。
- **文件系统是临时的**：所以线上绝不能用 SQLite，这也是数据库走 Postgres 的原因。
- **SECRET_KEY 一旦定了不要改**：改了库里已加密的 Key 全部解不开，只能让用户重新填。

---

## 五、费用

Supabase 免费档 + Render 免费档 + Pages 免费档 + 用户自带大模型 Key = **0 元**。
