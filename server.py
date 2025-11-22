import os
import pickle
import subprocess
import tempfile
import time
from pathlib import Path
from functools import lru_cache
from typing import Optional

from fastapi import FastAPI, Request, HTTPException, UploadFile, File
from pydantic import BaseModel
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette import EventSourceResponse, JSONServerSentEvent
import json
import asyncio
import shutil
from loguru import logger

# Remove default loguru handler and add custom one with debug level
logger.remove()
logger.add(
    lambda msg: print(msg, end=""),
    level="DEBUG",
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
)

from reader3 import Book, BookMetadata, ChapterContent, TOCEntry
from chat_service import chat_service, ChatRequest
from config_manager import get_config_manager, ModelConfig

app = FastAPI()

# Configuration
BOOKS_DIR = os.getenv("BOOKS_DIR", "./books")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")

# Ensure books and uploads directories exist
os.makedirs(BOOKS_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Add CORS middleware for frontend-backend separation
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Mount frontend directory for JavaScript files
app.mount("/js", StaticFiles(directory="frontend/js"), name="frontend_js")

# Mount frontend directory for CSS files
app.mount("/css", StaticFiles(directory="frontend/css"), name="frontend_css")

# Mount frontend API modules directory
app.mount("/frontend-api", StaticFiles(directory="frontend-api"), name="frontend_api")
# Mount frontend locales directory for i18n files
app.mount("/locales", StaticFiles(directory="frontend/locales"), name="frontend_locales")

# Frontend page serving
@app.get("/")
async def read_root():
    """Serve the main library page."""
    return FileResponse("frontend/index.html")

@app.get("/read/{book_id}/{chapter_index}")
async def read_book_page(book_id: str, chapter_index: int):
    """Serve the reader page for a specific book and chapter."""
    return FileResponse("frontend/reader.html")



# Pydantic models for chat API
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatApiRequest(BaseModel):
    prompt_type: str  # 'summarize', 'notes', 'qa'
    book_id: str
    chapter_index: int
    question: str = ""  # Only for Q&A
    conversation_history: Optional[list[ChatMessage]] = None


@lru_cache(maxsize=10)
def load_book_cached(book_id: str) -> Optional[Book]:
    """
    Loads the book from the pickle file.
    Cached so we don't re-read the disk on every click.
    """
    # Try the book_id as is first
    folder_name = book_id
    file_path = os.path.join(BOOKS_DIR, folder_name, "book.pkl")

    # If not found, try with _data suffix
    if not os.path.exists(file_path):
        folder_name = f"{book_id}_data"
        file_path = os.path.join(BOOKS_DIR, folder_name, "book.pkl")

    if not os.path.exists(file_path):
        logger.error(f"Book file not found for book_id: {book_id} (tried: {book_id}, {book_id}_data)")
        return None

    try:
        with open(file_path, "rb") as f:
            book = pickle.load(f)
        logger.info(f"Successfully loaded book from: {folder_name}")
        return book
    except Exception as e:
        logger.error(f"Error loading book {folder_name}: {e}")
        return None

# API Endpoints for Frontend-Backend Separation

@app.get("/api/books")
async def get_all_books():
    """Get all books in the library as JSON"""
    books = []

    if os.path.exists(BOOKS_DIR):
        for item in os.listdir(BOOKS_DIR):
            if item.endswith("_data") and os.path.isdir(os.path.join(BOOKS_DIR, item)):
                book_folder = os.path.join(BOOKS_DIR, item)
                try:
                    book = load_book_cached(item)
                    if book:
                        books.append({
                            "id": item.replace("_data", ""),
                            "title": book.metadata.title,
                            "author": book.metadata.authors[0] if book.metadata.authors else "Unknown",
                            "authors": book.metadata.authors,
                            "chapters": len(book.spine),
                            "image_count": len(book.images) if hasattr(book, 'images') else 0
                        })
                except Exception as e:
                    logger.error(f"Error loading book {item}: {e}")
                    continue

    return JSONResponse(content=books)

@app.get("/api/books/{book_id}")
async def get_book_details(book_id: str):
    """Get detailed information about a specific book"""
    book_folder = f"{book_id}_data"
    book = load_book_cached(book_folder)

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    book_data = {
        "id": book_id,
        "metadata": {
            "title": book.metadata.title,
            "authors": book.metadata.authors,
            "language": book.metadata.language,
            "identifier": book.metadata.identifiers[0] if book.metadata.identifiers else ""
        },
        "toc": [{"title": entry.title, "href": entry.href, "children": [{"title": child.title, "href": child.href} for child in entry.children]} for entry in book.toc],
        "spine": [{"href": ch.href, "order": ch.order} for ch in book.spine],
        "chapters": len(book.spine),
        "images": book.images if hasattr(book, 'images') else []
    }

    return JSONResponse(content=book_data)

@app.get("/api/books/{book_id}/chapters/{chapter_index}")
async def get_chapter_content(book_id: str, chapter_index: int):
    """Get content of a specific chapter"""
    book_folder = f"{book_id}_data"
    book = load_book_cached(book_folder)

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if chapter_index < 0 or chapter_index >= len(book.spine):
        raise HTTPException(status_code=404, detail="Chapter not found")

    chapter = book.spine[chapter_index]

    chapter_data = {
        "index": chapter_index,
        "title": chapter.title,
        "href": chapter.href,
        "content": chapter.content,
        "word_count": len(chapter.content.split()) if chapter.content else 0
    }

    return JSONResponse(content=chapter_data)

@app.get("/api/books/{book_id}/toc")
async def get_book_toc(book_id: str):
    """Get table of contents for a book"""
    book_folder = f"{book_id}_data"
    book = load_book_cached(book_folder)

    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    return JSONResponse(content=book.toc)


@app.get("/read/{book_id}/images/{image_name}")
async def serve_image(book_id: str, image_name: str):
    """
    Serves images specifically for a book.
    The HTML contains <img src="images/pic.jpg">.
    The browser resolves this to /read/{book_id}/images/pic.jpg.
    """
    # Security check: ensure book_id is clean
    safe_book_id = os.path.basename(book_id)
    safe_image_name = os.path.basename(image_name)

    # Try the book_id as is first (for backward compatibility)
    img_path = os.path.join(BOOKS_DIR, safe_book_id, "images", safe_image_name)

    # If not found, try with _data suffix (current format)
    if not os.path.exists(img_path):
        img_path = os.path.join(BOOKS_DIR, f"{safe_book_id}_data", "images", safe_image_name)

    if not os.path.exists(img_path):
        raise HTTPException(status_code=404, detail="Image not found")

    return FileResponse(img_path)

@app.post("/api/chat")
async def chat_with_content(request: ChatApiRequest):
    """Chat API for AI interactions with book content."""
    # Load the book
    book = load_book_cached(request.book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Validate chapter index
    if request.chapter_index < 0 or request.chapter_index >= len(book.spine):
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Get the chapter content
    current_chapter = book.spine[request.chapter_index]

    # Convert conversation history if provided
    history = None
    if request.conversation_history:
        history = [{"role": msg.role, "content": msg.content} for msg in request.conversation_history]

    # Create chat request
    chat_request = ChatRequest(
        prompt_type=request.prompt_type,
        content=current_chapter.text,  # Use plain text for better LLM processing
        title=current_chapter.title,
        book_title=book.metadata.title,
        chapter_num=request.chapter_index + 1,
        total_chapters=len(book.spine),
        question=request.question,
        conversation_history=history,
        authors=", ".join(book.metadata.authors) if book.metadata.authors else "未知作者",
        publisher=book.metadata.publisher or "未知出版社",
        book_description=book.metadata.description or "暂无简介",
        subjects=", ".join(book.metadata.subjects) if book.metadata.subjects else "未分类"
    )

    # Process the chat request
    response = await chat_service.chat(chat_request)

    if response.error:
        raise HTTPException(status_code=500, detail=response.error)

    return {
        "content": response.content,
        "model_used": response.model_used,
        "tokens_used": response.tokens_used
    }

@app.get("/api/chat/prompts")
async def get_available_prompts():
    """Get available chat prompt types."""
    return chat_service.get_available_prompts()

@app.get("/api/chat/status")
async def get_chat_status():
    """Get chat service status."""
    return {
        "available": chat_service.is_available(),
        "prompts_available": chat_service.get_available_prompts()
    }

@app.get("/api/chat/test-stream")
async def test_stream():
    """SSE test endpoint for streaming functionality."""
    async def test_generator():
        messages = [
            "这是",
            "一个",
            "流式",
            "测试",
            "消息",
            "。",
            "您",
            "应该",
            "看到",
            "这些",
            "文字",
            "逐步",
            "出现。",
        ]

        for i, msg in enumerate(messages):
            yield f"id: {i + 1}\nevent: message\ndata: {json.dumps({'content': msg + ' '})}\n\n"
            await asyncio.sleep(0.2)  # 200ms delay to see streaming clearly

        yield f"id: {len(messages) + 1}\nevent: done\ndata: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        test_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "X-Accel-Buffering": "no",
        }
    )

@app.get("/api/chat/stream")
async def chat_with_content_stream(
    prompt_type: str,
    book_id: str,
    chapter_index: int,
    question: str = "",
    conversation_history: str = "[]"
):
    """SSE streaming chat API for AI interactions with book content."""

    logger.info(f"Chat request received: prompt_type={prompt_type}, book_id={book_id}, chapter_index={chapter_index}, question='{question[:50]}...'")

    async def generate_chat_response():
        try:
            # Parse conversation history
            history = json.loads(conversation_history) if conversation_history else []
            history = [{"role": msg["role"], "content": msg["content"]} for msg in history]

            # Debug: List available book directories
            logger.info(f"Looking for book with ID: {book_id}")
            if os.path.exists(BOOKS_DIR):
                available_dirs = [d for d in os.listdir(BOOKS_DIR) if d.endswith("_data")]
                logger.info(f"Available book directories: {available_dirs}")

            # Load the book
            book = load_book_cached(book_id)
            if not book:
                logger.error(f"Book not found: {book_id}")
                yield JSONServerSentEvent(data={"error": f"Book not found: {book_id}"})
                return

            # Validate chapter index
            if chapter_index < 0 or chapter_index >= len(book.spine):
                yield JSONServerSentEvent(data={"error": "Chapter not found"})
                return

            # Get the chapter content
            current_chapter = book.spine[chapter_index]

            # Create chat request
            chat_request = ChatRequest(
                prompt_type=prompt_type,
                content=current_chapter.text,
                title=current_chapter.title,
                book_title=book.metadata.title,
                chapter_num=chapter_index + 1,
                total_chapters=len(book.spine),
                question=question,
                conversation_history=history,
                authors=", ".join(book.metadata.authors) if book.metadata.authors else "未知作者",
                publisher=book.metadata.publisher or "未知出版社",
                book_description=book.metadata.description or "暂无简介",
                subjects=", ".join(book.metadata.subjects) if book.metadata.subjects else "未分类"
            )

            logger.info(f"Starting OpenAI stream for {prompt_type} request")

            # Use the chat_service's async chat method with streaming
            if not chat_service.is_available():
                yield JSONServerSentEvent(data={"error": "Chat service not available. Please check OpenAI configuration."})
                return

            # Get the appropriate prompt and format the request
            from prompts import ChatPrompts, format_user_prompt
            prompt = ChatPrompts.get_prompt_by_name(prompt_type)
            system_prompt = prompt.system_prompt
            user_prompt = format_user_prompt(
                prompt_type=prompt_type,
                content=chat_request.content,
                title=chat_request.title,
                book_title=chat_request.book_title,
                chapter_num=chat_request.chapter_num,
                total_chapters=chat_request.total_chapters,
                question=chat_request.question,
                authors=chat_request.authors,
                publisher=chat_request.publisher,
                book_description=chat_request.book_description,
                subjects=chat_request.subjects
            )

            # Build messages for OpenAI with proper typing
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]

            # Add conversation history if provided (for Q&A)
            if chat_request.conversation_history and chat_request.prompt_type == "qa":
                messages = [messages[0]] + chat_request.conversation_history + [messages[1]]

            # Make streaming API call
            logger.info("Making streaming call to OpenAI...")
            if chat_service.async_client:
                stream = await chat_service.async_client.chat.completions.create(
                    model=chat_service.model,
                    messages=messages,  # type: ignore
                    temperature=chat_service.temperature,
                    max_tokens=chat_service.max_tokens,
                    stream=True
                )
            else:
                yield JSONServerSentEvent(data={"error": "OpenAI async client not initialized"})
                return

            # Process stream and yield each chunk
            chunk_count = 0
            async for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    choice = chunk.choices[0]
                    if hasattr(choice, 'delta') and choice.delta and hasattr(choice.delta, 'content') and choice.delta.content:
                        content = choice.delta.content
                        if content:
                            chunk_count += 1
                            logger.debug(f"Yielding chunk {chunk_count}: {repr(content)}")
                            # Use JSONServerSentEvent for structured data
                            yield JSONServerSentEvent(data={"content": content}, event="message")
                            # Optional: Force event loop control switch for immediate response
                            await asyncio.sleep(0)

            # Send completion event
            logger.info(f"Stream completed, sent {chunk_count} chunks")
            yield JSONServerSentEvent(data={"done": True}, event="done")

        except Exception as e:
            logger.error(f"Streaming error: {e}", exc_info=True)
            yield JSONServerSentEvent(data={"error": f"Failed to process request: {str(e)}"}, event="error")

    return EventSourceResponse(generate_chat_response(), ping=20, media_type="text/event-stream")

# Configuration Management API Endpoints

class ConfigRequest(BaseModel):
    """Request model for configuration updates."""
    provider: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model_name: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None

class LanguageRequest(BaseModel):
    """Request model for language configuration updates."""
    language: str

class DarkModeRequest(BaseModel):
    """Request model for dark mode configuration updates."""
    dark_mode: bool


@app.get("/api/config")
async def get_config():
    """Get current model configuration."""
    try:
        config_manager = get_config_manager()
        config = config_manager.get_model_config()

        if not config:
            return JSONResponse(
                status_code=404,
                content={"error": "No configuration found"}
            )

        # Don't expose the full API key in the response for security
        response_data = config.model_dump()
        if response_data.get("api_key"):
            response_data["api_key"] = "******" + response_data["api_key"][-4:] if len(response_data["api_key"]) > 4 else "******"

        return JSONResponse(content=response_data)

    except Exception as e:
        logger.error(f"Error getting config: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to get configuration"}
        )


@app.post("/api/config")
async def update_config(config_request: ConfigRequest):
    """Update model configuration."""
    try:
        config_manager = get_config_manager()

        # Prepare updates dictionary
        updates = {}
        if config_request.provider is not None:
            updates["provider"] = config_request.provider
        if config_request.api_key is not None:
            updates["api_key"] = config_request.api_key
        if config_request.base_url is not None:
            updates["base_url"] = config_request.base_url
        if config_request.model_name is not None:
            updates["model_name"] = config_request.model_name
        if config_request.temperature is not None:
            updates["temperature"] = config_request.temperature
        if config_request.max_tokens is not None:
            updates["max_tokens"] = config_request.max_tokens

        if not updates:
            return JSONResponse(
                status_code=400,
                content={"error": "No configuration updates provided"}
            )

        success = config_manager.update_model_config(updates)

        if success:
            return JSONResponse(content={"message": "Configuration updated successfully"})
        else:
            return JSONResponse(
                status_code=500,
                content={"error": "Failed to update configuration"}
            )

    except Exception as e:
        logger.error(f"Error updating config: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to update configuration"}
        )


@app.post("/api/config/reset")
async def reset_config():
    """Reset configuration to defaults."""
    try:
        config_manager = get_config_manager()

        # Create default configuration
        default_config = ModelConfig(
            api_key="",
            base_url="https://api.openai.com/v1",
            model_name="gpt-4o-mini",
            temperature=0.7,
            max_tokens=32000
        )

        success = config_manager.save_model_config(default_config)

        if success:
            return JSONResponse(content={"message": "Configuration reset to defaults"})
        else:
            return JSONResponse(
                status_code=500,
                content={"error": "Failed to reset configuration"}
            )

    except Exception as e:
        logger.error(f"Error resetting config: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to reset configuration"}
        )

@app.post("/api/config/language")
async def update_language_config(language_request: LanguageRequest):
    """Update language configuration and persist to TinyDB."""
    try:
        config_manager = get_config_manager()

        # Validate language code
        valid_languages = ['en', 'zh-CN']
        if language_request.language not in valid_languages:
            return JSONResponse(
                status_code=400,
                content={"error": f"Invalid language code. Supported languages: {valid_languages}"}
            )

        # Save language preference to TinyDB
        success = config_manager.save_language_config(language_request.language)

        if success:
            logger.info(f"Language configuration updated to: {language_request.language}")
            return JSONResponse(content={
                "message": "Language configuration updated successfully",
                "language": language_request.language
            })
        else:
            return JSONResponse(
                status_code=500,
                content={"error": "Failed to update language configuration"}
            )

    except Exception as e:
        logger.error(f"Error updating language config: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to update language configuration"}
        )

@app.get("/api/config/language")
async def get_language_config():
    """Get current language configuration."""
    try:
        config_manager = get_config_manager()
        language = config_manager.get_language_config()

        return JSONResponse(content={
            "language": language or "en"  # Default to 'en' if not set
        })

    except Exception as e:
        logger.error(f"Error getting language config: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to get language configuration"}
        )

@app.post("/api/config/dark_mode")
async def update_dark_mode_config(dark_mode_request: DarkModeRequest):
    """Update dark mode configuration and persist to TinyDB."""
    try:
        config_manager = get_config_manager()
        success = config_manager.save_dark_mode_config(dark_mode_request.dark_mode)

        if success:
            logger.info(f"Dark mode configuration updated to: {dark_mode_request.dark_mode}")
            return JSONResponse(content={
                "dark_mode": dark_mode_request.dark_mode
            })
        else:
            return JSONResponse(
                status_code=500,
                content={"error": "Failed to update dark mode configuration"}
            )

    except Exception as e:
        logger.error(f"Error updating dark mode config: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to update dark mode configuration"}
        )

@app.get("/api/config/dark_mode")
async def get_dark_mode_config():
    """Get current dark mode configuration."""
    try:
        config_manager = get_config_manager()
        dark_mode = config_manager.get_dark_mode_config()

        return JSONResponse(content={
            "dark_mode": dark_mode if dark_mode is not None else False  # Default to False if not set
        })

    except Exception as e:
        logger.error(f"Error getting dark mode config: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to get dark mode configuration"}
        )

@app.post("/api/upload-book")
async def upload_book(epub_file: UploadFile = File(...)):
    """Upload and process an EPUB file."""

    # Validate file type
    if not epub_file.filename or not epub_file.filename.lower().endswith('.epub'):
        return JSONResponse(
            status_code=400,
            content={"error": "Please upload a valid EPUB file"}
        )

    logger.info(f"Processing EPUB upload: {epub_file.filename}")

    # Save the uploaded EPUB file to UPLOAD_DIR
    original_filename = epub_file.filename
    safe_filename = "".join(c for c in original_filename if c.isalnum() or c in ('-', '_', '.')).strip()
    if not safe_filename:
        safe_filename = f"upload_{int(time.time())}.epub"

    upload_file_path = os.path.join(UPLOAD_DIR, safe_filename)

    # Save uploaded file permanently
    with open(upload_file_path, 'wb') as upload_file:
        shutil.copyfileobj(epub_file.file, upload_file)

    logger.info(f"Saved uploaded file to: {upload_file_path}")

    try:
        # Run reader3.py to process the EPUB file
        logger.info(f"Running reader3.py on {upload_file_path}")

        # Use the same virtual environment and command as you mentioned
        result = subprocess.run(
            ["uv", "run", "reader3.py", upload_file_path],
            capture_output=True,
            text=True,
            cwd="."  # Run in the current directory
        )

        # Find the generated data folder and copy it to BOOKS_DIR
        temp_base = os.path.splitext(os.path.basename(upload_file_path))[0]
        temp_data_folder = f"{temp_base}_data"
        temp_data_path = os.path.join(os.path.dirname(upload_file_path), temp_data_folder)

        # Generate a proper folder name based on the original filename
        original_base = os.path.splitext(os.path.basename(epub_file.filename))[0]
        safe_folder_name = "".join(c for c in original_base if c.isalnum() or c in ('-', '_')).strip()
        if not safe_folder_name:
            safe_folder_name = f"book_{int(time.time())}"
        final_data_folder = f"{safe_folder_name}_data"
        final_data_path = os.path.join(BOOKS_DIR, final_data_folder)

        # Copy the data folder to BOOKS_DIR if it exists
        data_folder_name = final_data_folder  # Use our generated folder name
        if os.path.exists(temp_data_path):
            logger.info(f"Copying data from {temp_data_path} to {final_data_path}")
            shutil.copytree(temp_data_path, final_data_path)
            # Clean up temporary data folder from UPLOAD_DIR
            shutil.rmtree(temp_data_path)

        if result.returncode != 0:
            logger.error(f"reader3.py failed: {result.stderr}")
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Failed to process EPUB file",
                    "details": result.stderr
                }
            )

        # Parse the output to extract book information
        logger.debug(f"reader3.py output:\n{result.stdout}")
        output_lines = result.stdout.strip().split('\n')
        book_info = {}
        for line in output_lines:
            logger.debug(f"Parsing line: {line}")
            if line.startswith('Title:'):
                book_info['title'] = line.split('Title:')[1].strip()
                logger.debug(f"Found title: {book_info['title']}")
            elif line.startswith('Authors:'):
                book_info['authors'] = line.split('Authors:')[1].strip()
                logger.debug(f"Found authors: {book_info['authors']}")
            elif line.startswith('Physical Files'):
                # Handle both "Physical Files (Spine):" and just "Physical Files:" formats
                if 'Physical Files (Spine):' in line:
                    book_info['chapters'] = line.split('Physical Files (Spine):')[1].strip()
                else:
                    book_info['chapters'] = line.split('Physical Files:')[1].strip()
                logger.debug(f"Found chapters: {book_info['chapters']}")
            elif line.startswith('Images extracted:'):
                book_info['images'] = line.split('Images extracted:')[1].strip()
                logger.debug(f"Found images: {book_info['images']}")
            elif 'Saved structured data to' in line:
                # We'll use the data_folder_name variable that we set earlier
                logger.debug("Found structured data save message")
                # Don't parse from this line anymore since we handle the folder copying separately

        # Set the correct data folder name
        book_info['data_folder'] = data_folder_name
        logger.info(f"Successfully processed: {book_info}")

        # Clear the cache to ensure new book appears in library
        load_book_cached.cache_clear()

        return JSONResponse(
            content={
                "message": f"Book '{book_info.get('title', epub_file.filename)}' processed successfully!",
                "book_info": book_info
            }
        )

    except Exception as e:
        # Clean up uploaded file on error
        if os.path.exists(upload_file_path):
            os.unlink(upload_file_path)

        logger.error(f"Upload processing error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to process EPUB file: {str(e)}"}
        )

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8123"))
    print(f"Starting server at http://{host}:{port}")
    uvicorn.run(app, host=host, port=port)
