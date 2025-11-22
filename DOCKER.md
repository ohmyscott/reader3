# Docker 部署指南

本项目支持使用 Docker 和 Docker Compose 进行部署。

## 快速开始

### 1. 准备环境

确保已安装 Docker 和 Docker Compose：
```bash
# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. 配置环境变量

复制并编辑环境配置文件：
```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
# 书籍存储目录（相对于项目根目录）
BOOKS_DIR=./books

# EPUB文件上传目录（相对于项目根目录）
UPLOAD_DIR=./uploads

# OpenAI 配置
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000
```

### 3. 使用 Docker Compose 部署（推荐）

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 4. 使用 Docker 部署

```bash
# 构建镜像
docker build -t reader3 .

# 运行容器
docker run -d \
  --name reader3 \
  -p 8123:8123 \
  -v $(pwd)/books:/app/books \
  -v $(pwd)/.env:/app/.env:ro \
  --restart unless-stopped \
  reader3
```

## 配置说明

### 环境变量

- `BOOKS_DIR`: 书籍存储目录（默认：`./books`）
- `UPLOAD_DIR`: EPUB文件上传目录（默认：`./uploads`）
- `OPENAI_BASE_URL`: OpenAI API 基础 URL
- `OPENAI_API_KEY`: OpenAI API 密钥
- `OPENAI_MODEL`: 使用的模型
- `OPENAI_TEMPERATURE`: 回复生成温度（0.0-1.0）
- `OPENAI_MAX_TOKENS`: 回复最大 token 数

### 数据持久化

- 书籍数据存储在 `./books` 目录中
- EPUB上传文件存储在 `./uploads` 目录中
- 通过 Docker volume 挂载确保数据持久化

### 网络配置

- 服务监听端口：`8123`
- 容器内部端口：`8123`

## 管理命令

### Docker Compose

```bash
# 启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f reader3

# 重启服务
docker-compose restart reader3

# 停止服务
docker-compose down

# 重新构建并启动
docker-compose up -d --build
```

### Docker

```bash
# 查看运行中的容器
docker ps

# 查看日志
docker logs -f reader3

# 重启容器
docker restart reader3

# 停止容器
docker stop reader3

# 删除容器
docker rm reader3

# 进入容器
docker exec -it reader3 /bin/bash
```

## 故障排除

### 1. 端口冲突

如果 8123 端口被占用，可以修改 `docker-compose.yml` 中的端口映射：
```yaml
ports:
  - "8124:8123"  # 使用 8124 端口
```

### 2. 权限问题

确保 `books` 目录有正确的权限：
```bash
sudo mkdir -p ./books
sudo chmod 755 ./books
sudo chown $USER:$USER ./books
```

### 3. API 配置问题

检查 `.env` 文件中的 API 配置是否正确，确保 API 密钥有效。

### 4. 镜像构建失败

如果镜像构建失败，可以尝试：
```bash
# 清理 Docker 缓存
docker system prune -f

# 重新构建
docker-compose build --no-cache
```

## 访问应用

启动成功后，可以通过以下地址访问：
- Web 界面：http://localhost:8123
- API 文档：http://localhost:8123/docs

## 生产环境部署

对于生产环境，建议：

1. 使用 HTTPS（通过反向代理如 Nginx）
2. 设置强密码和 API 密钥
3. 定期备份数据目录
4. 使用资源限制：
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '1.0'
         memory: 512M
   ```

## 更新应用

更新代码后：
```bash
# 重新构建并启动
docker-compose up -d --build
```