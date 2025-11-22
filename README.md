# Reader3 - 智能EPUB阅读器

A lightweight, self-hosted EPUB reader designed for reading books together with AI assistants. Read through EPUB books one chapter at a time, making it easy to copy chapter content to LLMs for enhanced reading and learning.

![Reader3](https://img.shields.io/badge/Reader3-v3.0-blue.svg) ![License](https://img.shields.io/badge/License-MIT-green.svg) ![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)

## ✨ 核心特性

- 📚 **EPUB阅读器**: 完整的EPUB文件支持，逐章阅读
- 🤖 **AI助手**: 内置聊天功能，与AI讨论书籍内容
- 🖼️ **图片支持**: 显示EPUB中的图片内容
- 📋 **目录导航**: 轻松浏览书籍结构
- 💬 **智能快捷键**: 快速总结、分析等功能
- 🐳 **Docker部署**: 支持Docker和Docker Compose
- 🛠️ **开发工具**: 完整的开发和部署工具链
- 🌐 **响应式设计**: 支持多设备访问

## 🚀 快速开始

### 方式一：Docker Compose（推荐）

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd reader3
   ```

2. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，配置你的OpenAI API
   ```

3. **启动服务**
   ```bash
   docker-compose up -d
   ```

4. **访问应用**

   打开浏览器访问 [http://localhost:8123](http://localhost:8123)

### 方式二：本地开发

1. **安装依赖**
   ```bash
   # 使用uv（推荐）
   uv sync

   # 或使用pip
   pip install -r requirements.txt
   ```

2. **处理EPUB文件**
   ```bash
   # 下载示例EPUB文件（如：《德古拉》）
   # https://www.gutenberg.org/ebooks/345

   uv run python reader3.py your_book.epub
   ```

3. **启动服务器**
   ```bash
   uv run python server.py
   # 或使用运维工具
   ./ops.sh dev start
   ```

4. **访问应用**

   打开浏览器访问 [http://localhost:8123](http://localhost:8123)

## ⚙️ 配置说明

### 环境变量配置

复制 `.env.example` 到 `.env` 并配置以下参数：

```env
# 存储配置
BOOKS_DIR=./books                    # 书籍数据目录
UPLOAD_DIR=./uploads                  # EPUB上传目录

# OpenAI API配置
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000
```

### 服务配置

- **端口**: 8123（可通过环境变量修改）
- **绑定地址**: 0.0.0.0（生产环境）
- **数据持久化**: 通过Docker volume挂载

## 🛠️ 开发工具

项目提供了完整的运维工具 `ops.sh`：

```bash
# 开发环境
./ops.sh dev start     # 启动开发服务器
./ops.sh dev stop      # 停止服务器
./ops.sh dev restart   # 重启服务器
./ops.sh dev ps        # 查看服务状态

# 生产环境
./ops.sh prod start    # 启动Docker容器
./ops.sh prod stop     # 停止容器
./ops.sh prod build    # 构建Docker镜像

# 文件管理
./ops.sh ls            # 查看书籍统计信息
./ops.sh clean lru     # 清理旧文件（保留最新10个）
./ops.sh clean lru 5   # 保留最新5个文件

# 帮助
./ops.sh help          # 显示所有命令
```

## 📁 项目结构

```
reader3/
├── server.py              # 主服务器
├── reader3.py             # EPUB处理工具
├── ops.sh                 # 运维工具
├── migrate_books.py       # 数据迁移工具
├── test-docker.sh         # Docker测试脚本
├── docker-compose.yml     # Docker Compose配置
├── Dockerfile            # Docker镜像构建
├── frontend/             # 前端文件
│   ├── index.html        # 主页面
│   ├── css/             # 样式文件
│   └── js/              # JavaScript文件
├── templates/            # 服务端模板
├── books/               # 书籍数据目录
├── uploads/             # EPUB上传目录
└── .env.example         # 环境变量模板
```

## 🐳 Docker部署

### 基础部署

```bash
# 构建镜像
docker build -t reader3 .

# 运行容器
docker run -d \
  --name reader3 \
  -p 8123:8123 \
  -v $(pwd)/books:/app/books \
  -v $(pwd)/uploads:/app/uploads \
  reader3
```

### Docker Compose部署

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 健康检查和测试

```bash
# 运行Docker测试
./test-docker.sh
```

## 📚 使用指南

### 添加书籍

1. **Web界面上传**: 访问 [http://localhost:8123](http://localhost:8123)，点击"Upload Book"
2. **命令行处理**: `python reader3.py your_book.epub`
3. **批量迁移**: `python migrate_books.py`（从项目根目录迁移旧数据）

### AI助手功能

点击右下角的 💬 按钮使用AI聊天：

- 📝 **智能总结**: 自动总结章节内容
- 📋 **结构笔记**: 生成结构化阅读笔记
- ❓ **智能问答**: 基于上下文的问题回答
- 💾 **对话历史**: 保存和回顾聊天记录

### 快捷命令

在AI聊天中使用以下快捷命令：

- `/summary` - 总结当前章节
- `/notes` - 生成阅读笔记
- `/analyze` - 分析内容要点
- `/translate` - 翻译内容（如需要）

## 🔄 数据迁移

如果你有旧版本的书籍数据：

```bash
# 自动迁移到新的目录结构
python migrate_books.py

# 或手动指定目录
BOOKS_DIR=/path/to/books python migrate_books.py
```

## 🔧 故障排除

### 常见问题

1. **依赖安装失败**
   ```bash
   uv sync --refresh
   # 或清理缓存重新安装
   rm -rf .venv && uv sync
   ```

2. **OpenAI API错误**
   - 检查API Key是否正确
   - 确认网络连接正常
   - 验证API端点URL

3. **Docker相关问题**
   ```bash
   # 清理Docker缓存
   docker system prune -f

   # 重新构建镜像
   docker-compose build --no-cache
   ```

4. **端口冲突**
   ```bash
   # 检查端口占用
   lsof -i :8123

   # 或修改docker-compose.yml中的端口映射
   ```

### 开发模式

```bash
# 安装开发依赖
uv sync --extra dev

# 运行测试
pytest

# 代码格式化
black .

# 代码检查
flake8
```

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Project Gutenberg](https://www.gutenberg.org/) - 提供大量免费EPUB书籍
- [FastAPI](https://fastapi.tiangolo.com/) - 高性能Web框架
- [Alpine.js](https://alpinejs.dev/) - 轻量级前端框架
- [Tailwind CSS](https://tailwindcss.com/) - 实用CSS框架

## 📞 支持

如果你遇到问题或有建议：

1. 查看 [故障排除](#故障排除) 部分
2. 搜索现有的 [Issues](../../issues)
3. 创建新的 Issue 描述问题

---

**Reader3** - 让阅读与AI同行 🚀