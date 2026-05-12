# Game Dev Tracker Cloudflare 上传版

这是一个适合直接上传到 GitHub 网页版的小项目，不包含 `node_modules`。

## 文件结构

```text
game-dev-tracker-cloud-upload/
├─ index.html
├─ wrangler.toml
├─ functions/
│  └─ api/
│     └─ data.js
├─ migrations/
│  └─ 0001_init.sql
└─ .gitignore
```

## GitHub 网页上传

1. 在 GitHub 新建一个仓库。
2. 打开仓库页面，点 `Add file` -> `Upload files`。
3. 把这个文件夹里的内容拖进去：`index.html`、`wrangler.toml`、`functions`、`migrations`、`.gitignore`、`README.md`。
4. 提交即可。

不要上传 `node_modules`，这个版本不需要它。

## Cloudflare Pages 部署

1. Cloudflare Dashboard -> `Workers & Pages` -> `Create application` -> `Pages` -> `Connect to Git`。
2. 选择刚才的 GitHub 仓库。
3. 构建设置：
   - Framework preset: `None`
   - Build command: 留空
   - Build output directory: `/`
4. 部署完成后，在 Pages 项目里绑定 D1 数据库。

## 创建并绑定 D1

在 Cloudflare Dashboard 里：

1. `Storage & Databases` -> `D1 SQL Database` -> `Create`。
2. 数据库名建议用：`game-dev-tracker-db`。
3. 回到 Pages 项目 -> `Settings` -> `Functions` -> `D1 database bindings`。
4. 添加绑定：
   - Variable name: `DB`
   - D1 database: 选择 `game-dev-tracker-db`

## 初始化数据库表

打开 D1 数据库的控制台，把 `migrations/0001_init.sql` 里的 SQL 复制进去执行一次。

也可以用 Wrangler CLI：

```bash
npx wrangler d1 migrations apply game-dev-tracker-db --remote
```

## 使用

访问 Cloudflare Pages 给你的网址，例如：

```text
https://你的项目名.pages.dev
```

所有人访问同一个网址，就会读写同一个 D1 数据库。这个版本是“最后一次保存生效”的协作模式，适合小团队记录任务、设计文档和开发进度。
