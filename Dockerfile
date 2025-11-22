# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Copy project files
COPY pyproject.toml uv.lock ./
COPY .env.example ./.env

# Install dependencies
RUN uv sync --frozen

# Copy application code
COPY reader3.py .
COPY server.py .
COPY chat_service.py .
COPY prompts.py .
COPY migrate_books.py .
COPY -r frontend/ ./frontend/

# Create books and uploads directories with proper permissions
RUN mkdir -p /app/books /app/uploads && \
    chmod 755 /app/books /app/uploads

# Set environment variables
ENV BOOKS_DIR=/app/books
ENV UPLOAD_DIR=/app/uploads
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8123

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8123/api/books || exit 1

# Run the application
CMD ["uv", "run", "python", "server.py"]