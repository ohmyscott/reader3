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

app = FastAPI()

# Add CORS middleware for frontend-backend separation
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files directory
app.mount("/static", StaticFiles(directory="static"), name="static")

# Mount frontend directory for JavaScript files
app.mount("/js", StaticFiles(directory="frontend/js"), name="frontend_js")

# Mount frontend directory for CSS files
app.mount("/css", StaticFiles(directory="frontend/css"), name="frontend_css")

# Mount frontend API modules directory
app.mount("/frontend-api", StaticFiles(directory="frontend/api"), name="frontend_api")

# Serve index.html for the root route
@app.get("/", response_class=FileResponse)
async def serve_index():
    return FileResponse("frontend/index.html")

# Serve index.html for reader routes (SPA routing)
@app.get("/read/{book_id}", response_class=FileResponse)
async def serve_reader_with_book():
    return FileResponse("frontend/index.html")

@app.get("/read/{book_id}/{chapter_index}", response_class=FileResponse)
async def serve_reader_with_chapter():
    return FileResponse("frontend/index.html")


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

# Where are the book folders located?
BOOKS_DIR = "."

@lru_cache(maxsize=10)
def load_book_cached(folder_name: str) -> Optional[Book]:
    """
    Loads the book from the pickle file.
    Cached so we don't re-read the disk on every click.
    """
    file_path = os.path.join(BOOKS_DIR, folder_name, "book.pkl")
    if not os.path.exists(file_path):
        return None

    try:
        with open(file_path, "rb") as f:
            book = pickle.load(f)
        return book
    except Exception as e:
        print(f"Error loading book {folder_name}: {e}")
        return None

# API Endpoints for Frontend-Backend Separation

@app.get("/api/books")
async def get_all_books():
    """Get all books in the library as JSON"""
    books = []

    if os.path.exists(BOOKS_DIR):
        for item in os.listdir(BOOKS_DIR):
            if item.endswith("_data") and os.path.isdir(item):
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

    img_path = os.path.join(BOOKS_DIR, safe_book_id, "images", safe_image_name)

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

    async def generate_chat_response():
        try:
            # Parse conversation history
            history = json.loads(conversation_history) if conversation_history else []
            history = [{"role": msg["role"], "content": msg["content"]} for msg in history]

            # Load the book
            book = load_book_cached(book_id)
            if not book:
                yield JSONServerSentEvent(data={"error": "Book not found"})
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

    return EventSourceResponse(generate_chat_response(), ping=20)

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

    # Create a temporary file to save the uploaded EPUB
    with tempfile.NamedTemporaryFile(delete=False, suffix='.epub') as temp_file:
        shutil.copyfileobj(epub_file.file, temp_file)
        temp_file_path = temp_file.name

    try:
        # Run reader3.py to process the EPUB file
        logger.info(f"Running reader3.py on {temp_file_path}")

        # Use the same virtual environment and command as you mentioned
        result = subprocess.run(
            ["uv", "run", "reader3.py", temp_file_path],
            capture_output=True,
            text=True,
            cwd="."  # Run in the current directory
        )

        # Find the generated data folder and copy it to current directory
        temp_base = os.path.splitext(os.path.basename(temp_file_path))[0]
        temp_data_folder = f"{temp_base}_data"
        temp_data_path = os.path.join(os.path.dirname(temp_file_path), temp_data_folder)

        # Generate a proper folder name based on the original filename
        original_base = os.path.splitext(os.path.basename(epub_file.filename))[0]
        safe_folder_name = "".join(c for c in original_base if c.isalnum() or c in ('-', '_')).strip()
        if not safe_folder_name:
            safe_folder_name = f"book_{int(time.time())}"
        final_data_folder = f"{safe_folder_name}_data"
        final_data_path = os.path.join(".", final_data_folder)

        # Copy the data folder to current directory if it exists
        data_folder_name = final_data_folder  # Use our generated folder name
        if os.path.exists(temp_data_path):
            logger.info(f"Copying data from {temp_data_path} to {final_data_path}")
            shutil.copytree(temp_data_path, final_data_path)
            # Clean up temporary data folder
            shutil.rmtree(temp_data_path)

        # Clean up temporary file
        os.unlink(temp_file_path)

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
        # Clean up temporary file on error
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

        logger.error(f"Upload processing error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to process EPUB file: {str(e)}"}
        )

if __name__ == "__main__":
    import uvicorn
    print("Starting server at http://127.0.0.1:8123")
    uvicorn.run(app, host="127.0.0.1", port=8123)
