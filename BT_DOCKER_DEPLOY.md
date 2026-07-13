# AikArt 宝塔 Docker 部署

## 1. 准备服务器

1. 在域名控制台添加 `A` 记录，指向服务器公网 IP。
2. 在宝塔“软件商店”安装 Docker 和 Nginx。
3. 服务器安全组和宝塔防火墙放行 `80`、`443`，不需要放行 `8080`。

## 2. 下载并启动项目

在宝塔“终端”执行：

```bash
cd /www/wwwroot
git clone -b main https://github.com/XX1314521/ai.git aikart
cd aikart
docker compose up -d --build
```

如果之前构建失败，先清理失败的构建缓存再重试：

```bash
docker builder prune -f
docker compose build --no-cache
docker compose up -d
```

确认容器正常：

```bash
docker compose ps
curl -I http://127.0.0.1:8080
```

`aikart-web` 显示 `healthy`，并且 `curl` 返回 `200` 即启动成功。

## 3. 在宝塔绑定域名

1. 打开“网站”，添加一个站点并填写域名。
2. 进入该站点的“设置 > 反向代理 > 添加反向代理”。
3. 代理名称填写 `AikArt`。
4. 目标 URL 填写 `http://127.0.0.1:8080`。
5. 发送域名选择 `$host`，保存并启用代理。
6. 打开“SSL”，申请 Let's Encrypt 证书，然后开启“强制 HTTPS”。

Docker 内的 Nginx 已处理 React Router 回退，直接访问或刷新 `/commerce`、`/canvas`、`/video` 不会出现 404。

## 4. 更新网站

代码推送到 GitHub 后，在服务器执行：

```bash
cd /www/wwwroot/aikart
git pull origin main
docker compose up -d --build
docker image prune -f
```

查看运行日志：

```bash
docker compose logs -f --tail=100
```

回滚到指定提交：

```bash
git checkout <commit-id>
docker compose up -d --build
```

## 5. 宝塔 Compose 界面部署

也可以进入“Docker > Compose > 添加 Compose”，项目目录选择 `/www/wwwroot/aikart`，Compose 文件选择该目录下的 `docker-compose.yml`，然后执行构建并启动。

注意：不要把 API Key 写进 `Dockerfile`、Compose 或前端源码。当前网站是浏览器端应用，写进前端的 Key 都能被访问网站的人查看。
