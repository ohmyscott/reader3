# Reader3 - 智能EPUB阅读器

## 安装和设置

### 1. 使用uv安装依赖

```bash
# 安装依赖
uv sync

# 激活虚拟环境
source .venv/bin/activate  # Linux/Mac
# 或
.venv\Scripts\activate     # Windows
```

### 2. 配置OpenAI API

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入你的配置
nano .env  # 或使用任何文本编辑器
```

在 `.env` 文件中配置：

```env
# OpenAI API Base URL (使用官方或自定义端点)
OPENAI_BASE_URL=https://api.openai.com/v1

# OpenAI API Key
OPENAI_API_KEY=your_actual_api_key_here

# OpenAI Model (推荐模型)
OPENAI_MODEL=gpt-4o-mini

# 可选：生成温度 (0.0-1.0)
OPENAI_TEMPERATURE=0.7

# 可选：最大token数
OPENAI_MAX_TOKENS=2000
```

### 3. 启动服务器

```bash
python server.py
```

服务器将在 http://127.0.0.1:8123 启动

### 4. 使用说明

1. **添加书籍**：使用 `python reader3.py your_book.epub` 处理EPUB文件
2. **访问图书馆**：在浏览器中打开 http://127.0.0.1:8123
3. **开始阅读**：点击书籍标题开始阅读
4. **AI助手**：点击右下角的 💬 按钮使用AI聊天功能

## 功能特性

- 📚 **EPUB阅读**：完整的EPUB文件支持
- 🎨 **现代化界面**：响应式设计，支持多设备
- 📋 **复制功能**：一键复制章节内容
- 🤖 **AI助手**：
  - 📝 智能总结章节内容
  - 📋 生成结构化阅读笔记
  - ❓ 基于上下文的智能问答
  - 💾 对话历史记录

## 故障排除

### 常见问题

1. **依赖安装失败**
   ```bash
   uv sync --refresh
   ```

2. **OpenAI API错误**
   - 检查API Key是否正确
   - 确认网络连接正常
   - 验证API端点URL

3. **聊天功能不可用**
   - 确认已正确配置 `.env` 文件
   - 检查OpenAI API余额
   - 查看服务器日志获取详细错误信息

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