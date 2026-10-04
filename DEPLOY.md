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
2. 打开 Render → New → Blueprint，选这个仓库，它会读**仓库根目录的** `render.yaml` 自动建服务。
   （Blueprint 必须在仓库根目录，服务代码在 `server/`，靠 `rootDir: server` 指过去——这两个配置缺一不可。）

   **直达链接**（省得在菜单里翻）：
   ```
   https://dashboard.render.com/blueprint/new?repo=https://github.com/Earncreate/wuyou-zhanbu
   ```

   若 Render 没找到 Blueprint 文件，就手动 New → Web Service，填这些：
     - Runtime: Python 3
     - Root Directory: `server`（**最关键**，不填会在仓库根找 requirements.txt 直接失败）
     - Build Command: `pip install -r requirements.txt`
     - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
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

以下是 Render 官方文档 `/docs/free` 明确写着的条款，不是传闻：

- **绑卡不是必需的**：Render 注册本身免费（`your-first-deploy` 文档写 "Signing up is fast and free"）。
  注册后可能出现「Add Card 验证身份」弹窗，那是**身份验证的强化措施**，不是免费档的入场券。
  弹窗右上角有 ×，关掉继续用免费档即可。
  - 唯一的影响：**没有付款方式时，一旦你把 5GB/月 的流量或构建分钟用超，Render 不会扣费，而是直接停掉你当月的所有免费服务**。
  - 本项目怎么用：每月 5GB 流量对个人练手绰绰有余（同步 + AI 流式返回），基本碰不到线。
- **服务主动外联流量过高会被停用**（官方原文：service-initiated traffic threshold）。
  官方举例就包括「访问外部数据库」「调用外部 API」——这正是我们每个用户都要做的事（连 Supabase、调大模型）。
  个人使用量下不会触发；真触发的话，Render 会邮件通知，升级任意付费档位即可恢复。
- **750 实例小时/月**：一个全天不休的服务约 720 小时，基本刚好够。保活方案可行。
- **Render 免费 Postgres 30 天过期**（建库起算，14 天宽限期后删除数据）——本项目用 Supabase，规避了这个坑。
- **Supabase 免费项目连续 7 天无访问会被暂停**，去面板点 Restore 即可恢复（数据不丢）。
- **文件系统是临时的**：所以线上绝不能用 SQLite，这也是数据库走 Postgres 的原因。
- **SECRET_KEY 一旦定了不要改**：改了库里已加密的 Key 全部解不开，只能让用户重新填。
- **冷启动 30–60 秒**：休眠后第一次访问要等，Render 会显示加载页。保活可缓解。

---

## 五、费用

Supabase 免费档 + Render 免费档 + Pages 免费档 + 用户自带大模型 Key = **0 元**。
