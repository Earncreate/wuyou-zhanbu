# 无忧占卜 · 云同步后端

给网页端补上三件纯静态做不到的事：**登录注册（邀请码）**、**占卜历史多端同步**、**API Key 云端保管**。
未配置服务地址时，网页端仍是原来的纯离线用法，一点不受影响。

## 一、接口一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查（保活也打它） |
| POST | `/api/auth/register` | 注册，需邀请码，成功直接返回 token |
| POST | `/api/auth/login` | 登录，返回 JWT（默认 30 天） |
| GET | `/api/auth/me` | 当前账号 |
| POST | `/api/auth/password` | 改密码（body: old/new） |
| POST | `/api/records/sync` | 记录「推 + 拉」一次做完，冲突取时间戳大的 |
| GET | `/api/records` | 全量/增量拉取（?since=毫秒） |
| DELETE | `/api/records/{id}` | 删一条（软删，能同步到别的设备） |
| DELETE | `/api/records` | 清空本人全部记录 |
| GET | `/api/records/stats` | 本人应验统计（按模块/按卦） |
| GET/PUT | `/api/keys` | 读取/保存大模型 Key（只回掩码，库里存密文） |
| POST | `/api/llm/chat` | 服务端代理调大模型，SSE 流式，浏览器不接触 Key |
| POST | `/api/admin/invites` | 生成邀请码（默认仅 root） |
| GET | `/api/admin/invites` | 列出未使用的邀请码 |
| GET | `/api/admin/stats` | 全站应验统计：按模块/按卦/按用户（默认仅 root） |
| GET | `/api/admin/feedback` | 反馈明细，可 `?level=&username=` 过滤，含备注原文 |
| POST | `/api/admin/backfill` | 从 payload 回填反馈冗余列（仅换列结构或改提取逻辑时才用） |

## 二、本地跑起来

```bash
cd server
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8123
# 打开 http://127.0.0.1:8123/docs 看接口文档
```

首次启动会自动建表并写入预置账号（root:886260 / user:vxea418707）与 5 个邀请码。

回归测试（服务需先起在 8123）：

```bash
python ../tmp/test_server_api.py          # 后端 29 项
node ../tmp/test_cloud_ui.js              # 前端 30 项（jsdom 接真实后端）
```

## 三、数据库：必须用 Postgres，不能用 SQLite

Render / Koyeb 免费实例的文件系统是临时的，重启或重新部署后 `wyzb.db` 直接归零，
占卜历史和 Key 会全丢。本地开发可以留空用 SQLite，线上一定换成 Postgres。

二选一，都是免费档：

- **Neon**（推荐）：console.neon.tech → New Project → 复制连接串，冷启动约 1 秒。
- **Supabase**：supabase.com → New Project → Settings → Database → Connection string (URI)，500MB 容量。

## 四、部署后端

### Render（免费档）

1. render.com → New → Blueprint，选这个仓库，读 `render.yaml` 自动建服务；
   或 New → Web Service，手动填：Build `pip install -r requirements.txt`，
   Start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`。
2. 环境变量里填 `DATABASE_URL`（Postgres 连接串），`SECRET_KEY` 用 `generateValue` 让它自动随机。
3. 部署完访问 `https://你的服务.onrender.com/api/health`，返回 `{"ok":true,...}` 即成功。

免费档 15 分钟无访问会休眠，冷启动约 30–50 秒。想避免首次打开慢，用 UptimeRobot 或
Cloudflare Worker 定时任务每 10 分钟打一次 `/api/health` 保活。

### Koyeb（不休眠的备选）

koyeb.com → Create Service → GitHub 仓库 → Builder 选 Buildpack/Python，
Run command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`，环境变量同上。
Koyeb 免费档不强制休眠，但同样没有持久盘，数据库还是得用 Neon/Supabase。

## 五、部署前端静态资源

前端无需构建，就是 `index.html` + `libs/`。三家里随便挑：

```bash
node tmp/make_pages_dist.js https://你的后端.onrender.com    # 生成 dist/，地址会写进配置
```

- **Cloudflare Pages**：Workers & Pages → Create → Upload assets，上传 `dist/` 里的东西，拿到 `xxx.pages.dev`。
- **GitHub Pages**：把 `dist/` 内容推到仓库根目录（或 `gh-pages` 分支）→ Settings → Pages 开启。
- **Vercel**：Import Project，Framework 选 Other，Output Directory 留空，直接传 `dist/`。

注意别把 `server/` 一起传上去（里面有 .env 和源码），脚本生成的 `dist/` 只含前端文件。

## 六、安全清单（上线前照着过一遍）

- [ ] `SECRET_KEY` 换成随机值，且**之后再也不要改**（改了库里的 Key 就解不开了）
- [ ] `ALLOWED_ORIGINS` 从 `*` 改成你的前端域名
- [ ] `root` / `user` 这两个预置密码强度很低，正式用之前在设置里改掉，或改 `SEED_USERS` 环境变量重配
- [ ] 5 个邀请码每个只能用一次，用完让 root 调 `/api/admin/invites` 再生成
- [ ] 全程 HTTPS：免费平台默认都给证书，别把 token 走 http

## 七、数据存在哪

| 数据 | 位置 | 说明 |
|---|---|---|
| 账号密码 | Postgres `users` | bcrypt 哈希，库里没有明文密码 |
| 邀请码 | Postgres `invite_codes` | 一次性，`used_by` 记录被谁用了 |
| 占卜记录 | Postgres `records` | payload 存整条记录，软删保证多端一致 |
| 大模型 Key | Postgres `user_keys` | Fernet 加密，接口只回 `sk-xxx***` 掩码 |
| JWT | 浏览器 localStorage | 30 天有效，退出即清 |

## 八、应验反馈闭环

用户在断卦后回填「后来准不准」，这是整套系统里唯一能反过来校验规则的数据来源。

- **等级**：1 未应验 / 2 大致应验 / 3 基本应验 / 4 完全应验 / 5 未到应期
- **口径**（`app/feedback.py`，前后端共用）：有结论 = 1..4，「未到应期」不计入分母；
  应验率 =（完全＋基本＋大致）÷ 有结论的卦
- **存哪**：反馈写在记录的 `payload.feedback` 里，同步时冗余到 `records.feedback_level/at/note`
  三列——统计要跨用户聚合，不能每次全表扫 JSON。两处由 `_apply_feedback` 保持一致。
- **怎么看**：普通用户访问 `/api/records/stats` 或网页端「我的准头」；
  管理员用 root 登录 `stats.html`，看全站概览、按模块/按卦/按用户排行，以及逐条反馈明细（含备注原文）。
- **别人的反馈会不会到我云端**：会。只要对方用你发的邀请码注册并登录过，
  他的记录（含反馈）就同步到同一个库；root 在 `stats.html` 直接可见，不需要对方配合。

> 改等级名称或口径时，`server/app/feedback.py` 与 `index.html` 里的 `FB_LEVELS` 必须同步改，
> 否则前端按钮和后端统计会对不上。
