# 后端开发环境搭建指南（Node + Docker）

> 面向新同事。目标：**30 分钟内**在本地跑通后端服务并提交第一个改动。
> 文中带 `<>` 或 `TODO` 的地方需要按我们项目的实际情况替换（见文末「需要补充的信息」）。

---

## 1. 你会得到什么

跑完这份文档后，你的本机应该具备：

- 能启动后端服务，并在 `http://localhost:3000/health` 返回 `{"status":"ok"}`
- 能连上本地数据库（跑在 Docker 里）
- 能在本地跑通测试和 lint
- 知道遇到问题该找谁、日志在哪看

**预计耗时**：首次安装约 30–40 分钟（主要花在下载镜像和依赖上）。

---

## 2. 前置条件

| 项目 | 要求 | 说明 |
| --- | --- | --- |
| 操作系统 | macOS 13+ / Windows 11 + WSL2 / Ubuntu 22.04+ | Windows 用户**必须走 WSL2**，不要在 Git Bash / CMD 里直接开发 |
| 内存 | ≥ 8 GB（推荐 16 GB） | Docker + Node + 编辑器同时跑比较吃内存 |
| 磁盘 | ≥ 20 GB 可用 | 镜像和 node_modules 很占空间 |
| 网络 | 能访问内网 Git 与 npm 私服 | 没有权限先找 <负责人> 开通 |
| 账号 | Git 仓库权限、内网 npm 私服 token | 入职当天由 <负责人> 分配 |

**版本要求（重要，版本不一致会出现莫名其妙的构建失败）**

- Node.js：`<20.x LTS>`（用 `.nvmrc` 锁定，见 3.1）
- pnpm / npm：`<pnpm 9.x>`
- Docker Engine：`≥ 24.0`，Docker Compose：`≥ 2.20`

> 不要用系统自带的 Node（比如 `apt install nodejs` 装的），版本通常太旧。统一用 nvm 管理。

---

## 3. 安装步骤

### 3.1 安装 Node 版本管理器

**macOS / Linux / WSL2**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# 重开终端，或执行：
source ~/.bashrc
nvm install    # 读取项目 .nvmrc，自动装对应版本
nvm use
node -v        # 应输出 v20.x.x
```

**Windows（走 WSL2 的话装在内层）**

```bash
# 在 WSL2 里同样用 nvm；不要在 Windows 宿主上用 nvm-windows 混用
sudo apt update && sudo apt install -y curl build-essential
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

**验证**

```bash
node -v && npm -v
```

### 3.2 安装包管理器

```bash
corepack enable
corepack prepare pnpm@9 --activate
pnpm -v
```

### 3.3 安装 Docker

- **macOS**：装 [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)，选 Apple Silicon / Intel 对应版本
- **Windows**：装 Docker Desktop，安装时勾选 **Use WSL 2 based engine**；并在 Docker Desktop → Settings → Resources → WSL Integration 里打开你的发行版
- **Ubuntu**：按[官方文档](https://docs.docker.com/engine/install/ubuntu/)装 Engine + Compose plugin，装完把当前用户加入 docker 组：

```bash
sudo usermod -aG docker $USER
newgrp docker     # 或重新登录
```

**验证**

```bash
docker version
docker compose version
docker run --rm hello-world     # 能打印欢迎语即成功
```

> 如果 `docker run` 报 `Cannot connect to the Docker daemon`，说明 Docker Desktop 没启动（或 WSL 集成没开）。

### 3.4 配置内网 npm 私服

```bash
npm config set registry <https://npm.内网地址/>
# 需要 token 的包：
npm config set //npm.内网地址/:_authToken "<你的 token>"
```

检查生效：

```bash
npm config get registry
```

### 3.5 配置 Git

```bash
git config --global user.name  "你的名字"
git config --global user.email "you@company.com"
# Windows 用户建议（避免换行符造成的整文件 diff）：
git config --global core.autocrlf input
```

### 3.6 克隆仓库

```bash
git clone <仓库地址>
cd <项目目录>
```

---

## 4. 启动项目

### 4.1 准备环境变量

```bash
cp .env.example .env
```

然后按下面的说明填写 `.env`（**不要提交 `.env`，已在 `.gitignore` 中忽略**）：

| 变量 | 说明 | 本地建议值 |
| --- | --- | --- |
| `NODE_ENV` | 运行环境 | `development` |
| `PORT` | 服务端口 | `3000` |
| `DATABASE_URL` | 数据库连接串 | `postgres://dev:dev@localhost:5432/app` |
| `REDIS_URL` | 缓存连接串 | `redis://localhost:6379` |
| `JWT_SECRET` | 本地随便填 | `local-dev-secret` |
| `LOG_LEVEL` | 日志级别 | `debug` |

> `.env.example` 是唯一可信的变量清单，如果发现文档和它不一致，以 `.env.example` 为准并顺手更新本文档。

### 4.2 启动依赖服务（数据库 / 缓存）

```bash
docker compose up -d
docker compose ps          # 全部应为 running / healthy
```

数据库首次启动需要初始化，等健康检查变绿（约 10–20 秒）。

### 4.3 安装依赖并建表

```bash
pnpm install
pnpm run db:migrate        # 建表
pnpm run db:seed           # 可选：灌入测试数据
```

### 4.4 启动服务

```bash
pnpm run dev
```

**验证**

```bash
curl http://localhost:3000/health
# 期望：{"status":"ok"}
```

再打开 `http://localhost:3000/<文档地址>`（`TODO`：Swagger 或 Apifox 链接）确认接口文档能访问。

### 4.5 开发期常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm run dev` | 热重载启动 |
| `pnpm run build` | 生产构建 |
| `pnpm test` | 跑单测 |
| `pnpm run test:e2e` | 跑端到端测试（需依赖服务已启动） |
| `pnpm run lint` | 代码检查（提交前必跑） |
| `docker compose logs -f api` | 看容器日志 |
| `docker compose down` | 停掉依赖服务（加 `-v` 会清空数据） |

---

## 5. 常见问题（FAQ）

**Q1：`pnpm install` 卡住或 404**
多半是私服没配好。执行 `npm config get registry` 确认指向内网地址；token 过期找 <负责人> 重新申请。

**Q2：端口已被占用 `EADDRINUSE :3000`**

```bash
# macOS / Linux / WSL2
lsof -i :3000
kill -9 <PID>
```
或改 `.env` 里的 `PORT`。

**Q3：连不上数据库 `ECONNREFUSED 127.0.0.1:5432`**

```bash
docker compose ps        # 容器起来了吗
docker compose logs db   # 看具体报错
```
常见原因：Docker Desktop 没启动、WSL 集成没开、或上次 `down -v` 后没重新 `db:migrate`。

**Q4：`node -v` 版本不对**
没执行 `nvm use`。建议在 shell 配置里加自动切换，或每次进目录先 `nvm use`。

**Q5：Windows 上文件改动特别慢**
项目必须放在 WSL2 的文件系统里（`~/code/...`），不要放在 `/mnt/c/...`，跨文件系统 IO 会慢十倍。

**Q6：构建报错提示找不到某个原生模块**
换 Node 版本后需要重装依赖：`rm -rf node_modules && pnpm install`。

**Q7：`docker compose up` 报端口冲突**
本机可能已有 Postgres/Redis 在跑（比如之前自己装的）。停掉系统服务，或改 `docker-compose.yml` 里的宿主端口映射。

自己排不动时：把**完整报错 + 你执行过的命令**贴到群里，不要只发一句「跑不起来」。

---

## 6. 提交第一个改动

```bash
git checkout -b feat/hello-<你的名字>
# ...改点东西...
pnpm run lint && pnpm test
git add -A && git commit -m "chore: onboarding test"
git push -u origin HEAD
```

然后在平台上开 MR，找 <导师/负责人> review。**第一个 MR 只做小改动**，目的是验证流程通不通。

---

## 7. 约定与注意事项

- **不要提交** `.env`、`node_modules`、本地数据卷
- **不要**在宿主机上装 Postgres/Redis，统一走 Docker，保证环境一致
- 依赖升级、`docker-compose.yml` 改动请先在群里同步，避免影响其他人
- 生产环境配置不要往本地复制，密钥走 <密钥管理方式>
- 提交信息用 `<Conventional Commits>`：`feat:` / `fix:` / `chore:`

---

## 8. 需要补充的信息（维护者填写）

本文档中的占位符需要项目维护者补齐后才能直接发给新同事：

- [ ] `<仓库地址>`、项目目录名
- [ ] Node / pnpm 的确切版本（写进 `.nvmrc` 和 `package.json` 的 `engines`）
- [ ] 内网 npm 私服地址与 token 申请流程
- [ ] 接口文档地址、健康检查路径
- [ ] 数据库/缓存的容器名、默认账号
- [ ] 负责人 / 导师 / 答疑群
- [ ] CI 与 MR 规范的实际链接

---

**最后**：如果你照着这份文档走的时候踩了坑，请直接把这一节补上——这份文档的价值就是让下一个人少踩一次。
