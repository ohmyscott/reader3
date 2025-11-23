# 📚 Reader3 - 智能EPUB阅读器与AI助手

<div align="center">

![Reader3 Banner](https://img.shields.io/badge/Reader3-v1.6.0-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)
![Multi-AI](https://img.shields.io/badge/AI%E6%8F%90%E5%95%86%E5%95%86-OpenAI%20%7C%20LM%20Studio%20%7C%20Ollama-orange.svg)

[![在线演示](https://img.shields.io/badge/%E5%9C%A8%E7%AB%99%E6%BC%94%E7%A4%BA-Live-green.svg)](https://reader3-demo.example.com)
[![Discord](https://img.shields.io/badge/Discord-%E5%8A%A0%E5%8A%A0-7289da.svg)](https://discord.gg/reader3)
[![文档](https://img.shields.io/badge/%E6%96%87%E6%A1%A3-Latest-brightgreen.svg)](docs/)

**现代化自托管EPUB阅读器，结合智能AI助手与本地隐私保护功能。**

</div>

## ✨ 核心特性

### 📖 **高级阅读体验**
- **完整EPUB支持**: 完全兼容EPUB 2.0和3.0标准
- **章节导航**: 直观的目录导航与进度跟踪
- **图片渲染**: 高质量的章节内图片显示
- **响应式设计**: 针对桌面、平板和移动设备优化
- **深色模式**: 低光环境下的护眼阅读模式

### 🤖 **多提供商AI集成**
- **OpenAI**: 完整API集成，支持GPT模型
- **LM Studio**: 本地AI模型支持，自动配置
- **Ollama**: 完整本地LLM集成，支持离线使用
- **提供商切换**: AI提供商间无缝切换
- **隐私保护**: 敏感内容本地处理选项

### 🛠️ **开发者友好**
- **现代技术栈**: FastAPI + Alpine.js + TailwindCSS
- **Docker支持**: 完整容器化与Docker Compose
- **API优先设计**: 易于集成的RESTful API
- **可扩展架构**: 插件就绪的自定义功能系统
- **全面工具**: 开发和部署实用工具

### 🌐 **国际化支持**
- **多语言支持**: 英语和简体中文
- **RTL文本支持**: 从右到左语言兼容性
- **本地化界面**: 完整的界面翻译
- **动态语言切换**: 运行时语言变更

## 🚀 快速开始

### 🐳 Docker Compose（推荐）

```bash
# 克隆仓库
git clone https://github.com/ohmyscott/reader3.git
cd reader3

# 配置环境
cp .env.example .env
# 编辑.env文件，配置您的AI提供商设置

# 启动应用
docker-compose up -d

# 访问应用
open http://localhost:8123
```

### 💻 本地开发

```bash
# 系统要求
Python 3.8+
Node.js 16+（用于前端开发）

# 安装依赖
pip install uv
uv sync

# 启动服务器
uv run python server.py

# 或使用运维脚本
./ops.sh dev start
```

## 🏗️ 系统架构

```mermaid
graph TB
    A[用户界面] --> B[前端 (Alpine.js + TailwindCSS)]
    B --> C[FastAPI 后端]
    C --> D[EPUB解析器]
    C --> E[AI服务层]
    E --> F[提供商抽象层]
    F --> G[OpenAI API]
    F --> H[LM Studio]
    F --> I[Ollama]
    C --> J[TinyDB 存储]
    C --> K[文件系统]
```

## ⚙️ 配置说明

### 环境变量配置

创建`.env`文件并配置您偏好的AI提供商：

```bash
# AI提供商选择 (openai, lmstudio, ollama)
AI_PROVIDER=ollama

# OpenAI配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# LM Studio配置
LMSTUDIO_BASE_URL=http://127.0.0.1:1234/v1
LMSTUDIO_MODEL=your_local_model

# Ollama配置
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1:8b

# 应用设置
PORT=8123
HOST=0.0.0.0
BOOKS_DIR=./books
UPLOAD_DIR=./uploads
```

### 提供商配置对比

| 提供商 | API密钥要求 | Base URL | 隐私性 | 成本 |
|--------|-------------|----------|--------|------|
| OpenAI | 必需 | api.openai.com | 云端 | 按令牌付费 |
| LM Studio | 可选 | 127.0.0.1:1234 | 本地 | 免费 |
| Ollama | 可选 | localhost:11434 | 本地 | 免费 |

## 📱 界面截图

<div align="center">

### 📚 图书馆视图
![图书馆视图](docs/images/library-view.png)

### 📖 阅读界面
![阅读界面](docs/images/reading-view.png)

### 🤖 AI助手
![AI助手](docs/images/ai-assistant.png)

### ⚙️ 设置界面
![设置界面](docs/images/settings.png)

</div>

## 🛠️ 开发指南

### 项目结构

```
reader3/
├── 📁 frontend/                 # 前端应用
│   ├── 📄 index.html           # 主应用页面
│   ├── 📄 reader.html          # 阅读器界面
│   ├── 📁 css/                  # 样式表
│   ├── 📁 js/                   # JavaScript模块
│   └── 📁 locales/              # 国际化文件
├── 📁 api/                     # API模块
├── 📁 data/                    # 数据存储
├── 📁 docs/                    # 文档
├── 🐳 docker-compose.yml       # Docker配置
├── 🐳 Dockerfile               # 容器定义
├── 📄 server.py                # FastAPI应用
├── 📄 reader3.py               # EPUB处理工具
├── 📄 ops.sh                   # 运维脚本
└── 📄 requirements.txt         # Python依赖
```

### 开发工作流

```bash
# 设置开发环境
./ops.sh dev setup

# 启动开发服务器
./ops.sh dev start

# 运行测试
./ops.sh test

# 代码格式化
./ops.sh format

# 类型检查
./ops.sh type-check
```

## 🐳 Docker部署

### 生产环境部署

我们推荐使用运维脚本进行生产环境部署：

```bash
# 快速生产环境设置
./ops.sh prod start

# 或直接使用Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# 扩展应用实例
docker-compose -f docker-compose.prod.yml up -d --scale reader3=3

# 检查生产环境状态
./ops.sh prod status
```

### 健康监控

```bash
# 健康检查端点
curl http://localhost:8123/health

# 应用状态
curl http://localhost:8123/api/status
```

## 📊 性能指标

### 基准测试

| 指标 | 数值 |
|------|------|
| 启动时间 | < 2秒 |
| 内存使用 | < 512MB（基础） |
| 书籍处理 | < 5秒每1000章节 |
| 并发用户 | 100+ |
| API响应时间 | < 500ms（本地AI） |

### 系统要求

**最低要求：**
- CPU: 2核
- RAM: 4GB
- 存储: 10GB
- 操作系统: Linux/macOS/Windows

**推荐配置：**
- CPU: 4核
- RAM: 8GB
- 存储: 50GB SSD
- 操作系统: Linux with Docker

## 🔧 运维管理

### 管理命令

```bash
# 应用管理
./ops.sh start          # 启动应用
./ops.sh stop           # 停止应用
./ops.sh restart        # 重启应用
./ops.sh status         # 检查状态

# 图书管理
./ops.sh books list     # 列出所有图书
./ops.sh books clean     # 清理旧图书
./ops.sh books backup    # 备份图书数据

# 数据库操作
./ops.sh db init         # 初始化数据库
./ops.sh db migrate      # 迁移数据
./ops.sh db backup       # 备份数据库
```

### 监控

```bash
# 应用日志
./ops.sh logs            # 查看日志
./ops.sh logs follow     # 跟踪日志

# 性能监控
./ops.sh monitor         # 系统指标
./ops.sh health          # 健康检查
```

## 🧪 测试

### 测试套件

```bash
# 运行所有测试
./ops.sh test

# 运行特定测试类别
./ops.sh test unit      # 单元测试
./ops.sh test integration # 集成测试
./ops.sh test e2e        # 端到端测试

# 测试覆盖率
./ops.sh test coverage   # 覆盖率报告
```

### 手动测试

```bash
# 测试不同AI提供商
./ops.sh test providers

# 测试EPUB处理
./ops.sh test epub

# 测试API端点
./ops.sh test api
```

## 🤝 贡献指南

我们欢迎贡献！请阅读我们的[贡献指南](CONTRIBUTING.md)了解详情。

### 开发流程

1. **Fork** 仓库
2. **创建** 功能分支: `git checkout -b feature/amazing-feature`
3. **提交** 更改: `git commit -m '添加惊人功能'`
4. **推送** 到分支: `git push origin feature/amazing-feature`
5. **打开** Pull Request

### 代码规范

- 遵循 [PEP 8](https://pep8.org/) Python代码规范
- 使用 [Black](https://black.readthedocs.io/) 进行代码格式化
- 为新功能编写全面的测试
- 更新API变更的文档

### 问题报告

- 使用[问题模板](.github/ISSUE_TEMPLATE/bug_report.md)报告bug
- 提供详细的复现步骤
- 包含系统信息和日志

## 📚 文档

- [**用户指南**](docs/user-guide.md) - 完整使用说明
- [**API参考**](docs/api.md) - REST API文档
- [**开发者指南**](docs/developer-guide.md) - 开发设置
- [**部署指南**](docs/deployment.md) - 生产环境部署
- [**故障排除**](docs/troubleshooting.md) - 常见问题解决

## 🔒 安全性

### 安全功能

- **本地AI选项**: 敏感内容本地处理
- **API密钥保护**: 安全存储和掩码显示
- **输入验证**: 全面的输入清理
- **CORS配置**: 正确的跨域设置
- **速率限制**: API请求节流

### 安全报告

请私下报告安全问题至 security@reader3.dev

## 📄 许可证

本项目采用MIT许可证 - 查看[LICENSE](LICENSE)文件了解详情。

## 🙏 致谢

- **[FastAPI](https://fastapi.tiangolo.com/)** - 现代Web框架
- **[Alpine.js](https://alpinejs.dev/)** - 轻量级JavaScript框架
- **[Tailwind CSS](https://tailwindcss.com/)** - 实用优先CSS框架
- **[Project Gutenberg](https://www.gutenberg.org/)** - 免费EPUB图书
- **[TinyDB](https://tinydb.readthedocs.io/)** - 轻量级数据库

## 📞 技术支持

- **文档**: [docs/](docs/)
- **问题**: [GitHub Issues](https://github.com/ohmyscott/reader3/issues)
- **讨论**: [GitHub Discussions](https://github.com/ohmyscott/reader3/discussions)
- **邮件**: support@reader3.dev

---

<div align="center">

**用❤️为热爱AI助手的读者们打造**

[![回到顶部](https://img.shields.io/badge/%E5%9B%9E%E5%88%B0%E9%A1%B6%E9%A1%B6-lightgrey.svg)](#readme3---智能epub阅读器与ai助手)

</div>