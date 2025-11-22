"""
Chat service for integrating with OpenAI API.
Handles chat interactions with the EPUB content.
"""

import os
from loguru import logger
import json
import asyncio
from typing import Dict, Optional, List
from dataclasses import dataclass
from config_manager import get_model_config

try:
    from openai import OpenAI, AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None
    AsyncOpenAI = None

from prompts import ChatPrompts, format_user_prompt



@dataclass
class ChatRequest:
    """Represents a chat request."""
    prompt_type: str  # 'summarize', 'notes', 'qa', 'analysis', 'critical', 'connection'
    content: str
    title: str
    book_title: str
    chapter_num: int = 1
    total_chapters: int = 1
    question: str = ""  # Only for Q&A prompts
    conversation_history: Optional[List[Dict[str, str]]] = None
    authors: str = ""  # Book authors
    publisher: str = ""  # Book publisher
    book_description: str = ""  # Book description
    subjects: str = ""  # Book subjects/keywords


@dataclass
class ChatResponse:
    """Represents a chat response."""
    content: str
    error: Optional[str] = None
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None


class ChatService:
    """Service for handling chat interactions with OpenAI."""

    def __init__(self):
        """Initialize the chat service with OpenAI configuration from TinyDB."""
        if not OPENAI_AVAILABLE:
            logger.error("OpenAI library not installed. Install with: pip install openai")
            self.client = None
            return

        # Get configuration from TinyDB
        config = get_model_config()

        if not config:
            logger.error("No configuration found. Please configure the AI model settings.")
            self.client = None
            return

        # Validate configuration
        # API key is optional for Ollama and LM Studio
        if not config.api_key and config.provider == "openai":
            logger.error("API key not configured for OpenAI. Please configure the AI model settings.")
            self.client = None
            return

        # For Ollama and LM Studio, use empty string as API key if not provided
        api_key = config.api_key or ""

        # Store configuration
        self.base_url = config.base_url
        self.api_key = api_key
        self.model = config.model_name
        self.temperature = config.temperature or 0.7
        self.max_tokens = config.max_tokens or 2000

        # Initialize OpenAI clients
        try:
            # Keep sync client for non-streaming requests
            self.client = OpenAI(
                base_url=self.base_url,
                api_key=self.api_key
            )

            # Initialize async client for streaming requests
            self.async_client = AsyncOpenAI(
                base_url=self.base_url,
                api_key=self.api_key
            )

            logger.info(f"Chat service initialized with model: {self.model}")
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
            self.client = None
            self.async_client = None

    def is_available(self) -> bool:
        """Check if the chat service is available."""
        return self.client is not None and self.async_client is not None

    def get_available_prompts(self) -> Dict[str, str]:
        """Get available prompt types with their titles."""
        prompts = ChatPrompts.get_all_prompts()
        return {name: prompt.title for name, prompt in prompts.items()}

    async def chat(self, request: ChatRequest) -> ChatResponse:
        """
        Process a chat request (non-streaming for compatibility).

        Args:
            request: Chat request with context and prompt type

        Returns:
            Chat response with content or error
        """
        if not self.is_available():
            return ChatResponse(
                content="",
                error="Chat service not available. Please check OpenAI configuration."
            )

        try:
            # Get the appropriate prompt
            prompt = ChatPrompts.get_prompt_by_name(request.prompt_type)
            system_prompt = prompt.system_prompt

            # Format user prompt with context
            user_prompt = format_user_prompt(
                prompt_type=request.prompt_type,
                content=request.content,
                title=request.title,
                book_title=request.book_title,
                chapter_num=request.chapter_num,
                total_chapters=request.total_chapters,
                question=request.question,
                authors=request.authors,
                publisher=request.publisher,
                book_description=request.book_description,
                subjects=request.subjects
            )

            # Build messages for OpenAI
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]

            # Add conversation history if provided (for Q&A)
            if request.conversation_history and request.prompt_type == "qa":
                # Insert history after system prompt but before current message
                messages = [messages[0]] + request.conversation_history + [messages[1]]

            # Make API call
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,  # type: ignore
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )

            # Extract response content
            content = response.choices[0].message.content or ""
            tokens_used = getattr(response.usage, 'total_tokens', None) if response.usage else None

            return ChatResponse(
                content=content,
                model_used=self.model,
                tokens_used=tokens_used
            )

        except Exception as e:
            logger.error(f"Chat API error: {e}")
            return ChatResponse(
                content="",
                error=f"Failed to process request: {str(e)}"
            )

    def chat_stream(self, request: ChatRequest):
        """
        Process a chat request with streaming response.

        Args:
            request: Chat request with context and prompt type

        Yields:
            Chunks of the response content
        """
        if not self.is_available():
            yield json.dumps({"error": "Chat service not available. Please check OpenAI configuration."})
            return

        try:
            # Get the appropriate prompt
            prompt = ChatPrompts.get_prompt_by_name(request.prompt_type)
            system_prompt = prompt.system_prompt

            # Format user prompt with context
            user_prompt = format_user_prompt(
                prompt_type=request.prompt_type,
                content=request.content,
                title=request.title,
                book_title=request.book_title,
                chapter_num=request.chapter_num,
                total_chapters=request.total_chapters,
                question=request.question,
                authors=request.authors,
                publisher=request.publisher,
                book_description=request.book_description,
                subjects=request.subjects
            )

            # Build messages for OpenAI
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]

            # Add conversation history if provided (for Q&A)
            if request.conversation_history and request.prompt_type == "qa":
                # Insert history after system prompt but before current message
                messages = [messages[0]] + request.conversation_history + [messages[1]]

            # Make streaming API call
            logger.info("Starting OpenAI stream...")
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=messages,  # type: ignore
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                stream=True
            )

            # Process stream immediately - yield each chunk as it arrives
            try:
                for chunk in stream:
                    if chunk.choices and len(chunk.choices) > 0:
                        choice = chunk.choices[0]
                        if hasattr(choice, 'delta') and choice.delta and hasattr(choice.delta, 'content') and choice.delta.content:
                            content = choice.delta.content
                            logger.debug(f"Real-time chunk: {content!r}")
                            # Yield immediately without any delay
                            chunk_data = json.dumps({"content": content})
                            yield chunk_data
                            logger.info(f"Yielded SSE data: {len(chunk_data)} chars")
                        else:
                            logger.debug(f"No content in chunk: {chunk}")
            except Exception as stream_error:
                logger.error(f"Stream processing error: {stream_error}")
                raise

        except Exception as e:
            logger.error(f"Chat streaming error: {e}")
            yield json.dumps({"error": f"Failed to process request: {str(e)}"})

    def test_connection(self) -> bool:
        """Test the connection to OpenAI API."""
        if not self.is_available():
            return False

        try:
            # Make a simple test request
            self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Hello"}],  # type: ignore
                max_tokens=10
            )
            return True
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False


# Global chat service instance
chat_service = ChatService()