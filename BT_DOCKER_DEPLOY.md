# AikArt 宝塔 Docker 部署

当前 Compose 会启动 5 个服务：网站、AikArt API、AikArt PostgreSQL、MinIO 和每日备份。爱坤Ai账户与余额仍使用原站点的 PostgreSQL，AikArt 不保存用户密码。

## 1. 准备爱坤Ai数据库连接

AikArt API 需要访问爱坤Ai PostgreSQL 的 `users` 和 `tokens` 表，用于登录后读取账户、创建专用访问密钥和同步余额。建议在爱坤Ai数据库中创建独立账号：

```sql
CREATE ROLE aikart_billing LOGIN PASSWORD '替换为强密码';
GRANT CONNECT ON DATABASE newapi TO aikart_billing;
GRANT USAGE, CREATE ON SCHEMA public TO aikart_billing;
GRANT SELECT, UPDATE ON TABLE users TO aikart_billing;
GRANT SELECT, INSERT ON TABLE tokens TO aikart_billing;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aikart_billing;
```

如果数据库不在同一台服务器，把连接中的主机改成实际内网地址，并在 PostgreSQL `pg_hba.conf` 中允许 Docker 网段访问。不要把数据库端口开放给整个公网。

## 2. 配置环境变量

```bash
cd /www/wwwroot/aikart
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
nano .env
```

把两次生成的值分别填入 `SESSION_SECRET` 和 `CONTENT_ENCRYPTION_KEY`。至少需要确认以下配置：

```dotenv
PUBLIC_ORIGIN=https://canvas.ikui.cn
AIKART_DB_PASSWORD=只使用字母数字的长密码
BILLING_DATABASE_URL=postgresql://aikart_billing:URL编码后的密码@host.docker.internal:5432/newapi
PLATFORM_ADMIN_AIKUN_USER_ID=爱坤Ai管理员用户ID
MINIO_ACCESS_KEY=aikartadmin
MINIO_SECRET_KEY=至少16位强密码
```

数据库密码含 `@`、`#`、`:` 等字符时，必须先做 URL 编码再写入 `BILLING_DATABASE_URL`。

## 3. 构建并启动

```bash
cd /www/wwwroot/aikart
docker compose config
docker compose up -d --build
docker compose ps
```

首次启动会自动创建 AikArt 数据表、MinIO 存储桶和爱坤Ai结算幂等表。检查：

```bash
curl -I http://127.0.0.1:8080
curl http://127.0.0.1:8080/api/health
docker compose logs --tail=100 api
```

所有容器应显示 `healthy`，`/api/health` 应返回 `{"status":"ok"...}`。

## 4. 宝塔绑定域名

1. 在 DNS 添加 `canvas.ikui.cn` 的 `A` 记录，指向服务器公网 IP。
2. 宝塔“网站”中新建 `canvas.ikui.cn`。
3. “反向代理”目标填写 `http://127.0.0.1:8080`。
4. 申请 Let's Encrypt 证书并开启强制 HTTPS。
5. 安全组只需要开放 `80`、`443`，不要公开 `8080`、`9001` 和数据库端口。

MinIO 管理台只监听服务器本机 `127.0.0.1:9001`。需要查看时使用宝塔 SSH 隧道，不要直接暴露公网。

## 5. 数据规则

- 手动上传的素材永久保存。
- 保存到“我的素材”或“我的作品”的生成结果永久保存。
- 发布到免费区或付费区的作品永久保存。
- 未保存且未发布的生成结果在 7 天后自动清理。
- 平台手续费默认 10%，最低售价 0.1，无最高价。
- 邀请佣金默认是平台手续费的 30%，由管理员后台修改。
- 备份容器每天将 AikArt PostgreSQL 和 MinIO 镜像到 `./backups`，默认保留 14 天。

## 6. 更新网站

```bash
cd /www/wwwroot/aikart
git pull origin main
docker compose up -d --build
docker compose ps
docker image prune -f
```

只查看 API 日志：

```bash
docker compose logs -f --tail=200 api
```

只查看前端代理日志：

```bash
docker compose logs -f --tail=200 web
```

## 7. 恢复备份

先停止写入，再恢复指定日期的数据库：

```bash
docker compose stop api web backup
gunzip -c backups/日期/aikart-postgres.sql.gz | docker compose exec -T app-db psql -U aikart -d aikart
docker compose start api web backup
```

MinIO 文件位于同一备份目录的 `minio/`。恢复前先保留当前 MinIO 数据卷，避免误覆盖。
