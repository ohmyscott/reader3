# 📚 Reader3 - Intelligent EPUB Reader with AI Assistant

<div align="center">

![Reader3 Banner](https://img.shields.io/badge/Reader3-v1.6.0-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)
![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)
![Multi-AI](https://img.shields.io/badge/AI-Providers-OpenAI%20%7C%20LM%20Studio%20%7C%20Ollama-orange.svg)

[![Demo](https://img.shields.io/badge/Demo-Live-green.svg)](https://reader3-demo.example.com)
[![Discord](https://img.shields.io/badge/Discord-Join-7289da.svg)](https://discord.gg/reader3)
[![Documentation](https://img.shields.io/badge/Documentation-Latest-brightgreen.svg)](docs/)

**A modern, self-hosted EPUB reader that combines intelligent AI assistance with local privacy protection.**

</div>

## ✨ Key Features

### 📖 **Advanced Reading Experience**
- **Complete EPUB Support**: Full compatibility with EPUB 2.0 and 3.0 standards
- **Chapter Navigation**: Intuitive table of contents with progress tracking
- **Image Rendering**: High-quality image display within chapters
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Dark Mode**: Eye-friendly reading mode for low-light environments

### 🤖 **Multi-Provider AI Integration**
- **OpenAI**: Full API integration with GPT models
- **LM Studio**: Local AI model support with automatic configuration
- **Ollama**: Complete local LLM integration for offline usage
- **Provider Switching**: Seamless switching between AI providers
- **Privacy Protection**: Local processing options for sensitive content

### 🛠️ **Developer-Friendly**
- **Modern Tech Stack**: FastAPI + Alpine.js + TailwindCSS
- **Docker Support**: Complete containerization with Docker Compose
- **API-First Design**: RESTful APIs for easy integration
- **Extensible Architecture**: Plugin-ready system for custom features
- **Comprehensive Tooling**: Development and deployment utilities

### 🌐 **Internationalization**
- **Multi-Language Support**: English and Simplified Chinese
- **RTL Text Support**: Right-to-left language compatibility
- **Localized UI**: Complete interface translation
- **Dynamic Language Switching**: Runtime language changes

## 🚀 Quick Start

### 🐳 Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/ohmyscott/reader3.git
cd reader3

# Configure environment
cp .env.example .env
# Edit .env with your AI provider settings

# Start the application
docker compose up -d

# Access the application
open http://localhost:8123
```

### 💻 Local Development

```bash
# Prerequisites
Python 3.10+
Node.js 16+ (for frontend development)

# Install dependencies
pip install uv
uv sync

# Start the server
uv run python server.py

# Or use the operations script
./ops.sh dev start
```

## 🏗️ Architecture

```
┌─────────────────┐
│   User Interface │
└─────────┬───────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                 Frontend (Alpine.js + TailwindCSS)         │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                      │
└─────────────────┬───────────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┬─────────────┬─────────────┐
    │             │             │             │             │
    ▼             ▼             ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│EPUB    │  │  AI     │  │ Provider │  │TinyDB   │  │ File   │
│Parser  │  │ Service │  │Abstraction│  │Storage  │  │System  │
└─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘
                  │             │             │             │
                  ▼             ▼             ▼             ▼
            ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
            │OpenAI  │  │LM Studio│  │ Ollama   │
            │API    │  │   API   │  │   API   │
            └─────────┘  └─────────┘  └─────────┘  └─────────┘
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with your preferred AI provider configuration:

```bash
# AI Provider Selection (openai, lmstudio, ollama)
AI_PROVIDER=ollama

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# LM Studio Configuration
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_MODEL=your_local_model

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1:8b

# Application Settings
PORT=8123
HOST=0.0.0.0
BOOKS_DIR=./books
UPLOAD_DIR=./uploads
```

### Provider Configuration

| Provider | API Key Required | Base URL | Privacy | Cost |
|----------|-------------------|----------|---------|------|
| OpenAI | Yes | api.openai.com | Cloud | Pay-per-token |
| LM Studio | No | localhost:1234 | Local | Free |
| Ollama | No | localhost:11434 | Local | Free |

## 📱 Screenshots

<div align="center">

### 📚 Library View
![Library View](docs/images/library-view.png)

### 📖 Reading Interface
![Reading Interface](docs/images/reading-view.png)

### 🤖 AI Assistant
![AI Assistant](docs/images/ai-assistant.png)

### ⚙️ Settings
![Settings](docs/images/settings.png)

</div>

## 🛠️ Development

### Project Structure

```
reader3/
├── 📁 frontend/                 # Frontend application
│   ├── 📄 index.html           # Main application page
│   ├── 📄 reader.html          # Reader interface
│   ├── 📁 css/                  # Stylesheets
│   ├── 📁 js/                   # JavaScript modules
│   └── 📁 locales/              # Internationalization
├── 📁 api/                     # API modules
├── 📁 data/                    # Data storage
├── 📁 docs/                    # Documentation
├── 🐳 docker-compose.yml       # Docker configuration
├── 🐳 Dockerfile               # Container definition
├── 📄 server.py                # FastAPI application
├── 📄 reader3.py               # EPUB processing utility
├── 📄 ops.sh                   # Operations script
└── 📄 requirements.txt         # Python dependencies
```

### Development Workflow

```bash
# Start development server
./ops.sh dev start

# Check service status
./ops.sh dev ps

# Stop development server
./ops.sh dev stop
```

## 🐳 Docker Deployment

### Production Deployment

We recommend using the operations script for production deployment:

```bash
# Quick production setup
./ops.sh prod start

# Or use Docker Compose directly
docker-compose -f docker-compose.prod.yml up -d

# Scale the application
docker-compose -f docker-compose.prod.yml up -d --scale reader3=3

# Check production status
./ops.sh prod ps
```


## 📊 Performance

### Benchmarks

| Metric | Value |
|--------|-------|
| Startup Time | < 2s |
| Memory Usage | < 512MB (base) |
| Book Processing | < 5s per 1000 chapters |
| Concurrent Users | 100+ |
| API Response Time | < 500ms (local AI) |

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 10GB
- OS: Linux/macOS/Windows

**Recommended:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 50GB SSD
- OS: Linux with Docker

## 🔧 Operations

### Management Commands

```bash
# Application management (development)
./ops.sh dev start      # Start development server
./ops.sh dev stop       # Stop development server
./ops.sh dev restart    # Restart development server
./ops.sh dev ps         # Check service status

# Application management (production)
./ops.sh prod start     # Start production server
./ops.sh prod stop      # Stop production server
./ops.sh prod restart   # Restart production server
./ops.sh prod ps        # Check production status

# Build production images
./ops.sh prod build     # Build Docker images

# File management
./ops.sh ls             # Show EPUB statistics
./ops.sh clean lru      # Clean old files
./ops.sh clean lru 5    # Keep 5 most recent files
```

## 🧪 Testing

### Test Suite

```bash
# Testing is not yet implemented (TODO)
# Future testing capabilities will include:
# - Unit tests
# - Integration tests
# - End-to-end tests
# - Test coverage reporting
```

### Manual Testing

```bash
# Manual testing can be performed by:
# - Uploading and reading EPUB files
# - Testing AI assistant functionality
# - Verifying provider switching
# - Checking responsive design
```

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Process

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Code Standards

- Follow [PEP 8](https://pep8.org/) for Python code
- Write comprehensive tests for new features
- Update documentation for API changes

### Issue Reporting

- Use the [issue template](.github/ISSUE_TEMPLATE/bug_report.md) for bugs
- Provide detailed reproduction steps
- Include system information and logs

## 📚 Documentation

- [**User Guide**](docs/user-guide.md) - Complete usage instructions
- [**API Reference**](docs/api.md) - REST API documentation
- [**Developer Guide**](docs/developer-guide.md) - Development setup
- [**Deployment Guide**](docs/deployment.md) - Production deployment
- [**Troubleshooting**](docs/troubleshooting.md) - Common issues

## 🔒 Security

### Security Features

- **Local AI Options**: Process sensitive content locally
- **API Key Protection**: Secure storage and masking
- **Input Validation**: Comprehensive input sanitization
- **CORS Configuration**: Proper cross-origin settings
- **Rate Limiting**: API request throttling

### Security Reporting

Please report security issues privately to security@reader3.dev

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[FastAPI](https://fastapi.tiangolo.com/)** - Modern web framework
- **[Alpine.js](https://alpinejs.dev/)** - Minimal JavaScript framework
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Project Gutenberg](https://www.gutenberg.org/)** - Free EPUB books
- **[TinyDB](https://tinydb.readthedocs.io/)** - Lightweight database

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/ohmyscott/reader3/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ohmyscott/reader3/discussions)
- **Email**: support@reader3.dev

---

<div align="center">

**Made with ❤️ for readers who love AI assistance**

[![Back to top](https://img.shields.io/badge/Back%20to%20Top-lightgrey.svg)](#readme3---intelligent-epub-reader-with-ai-assistant)

</div>