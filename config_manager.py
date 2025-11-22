#!/usr/bin/env python3
"""
Configuration management using TinyDB for storing application settings.
"""

import os
from pathlib import Path
from typing import Dict, Optional, Any
from tinydb import TinyDB, Query
from pydantic import BaseModel, Field
import json


class ModelConfig(BaseModel):
    """Model configuration for AI settings."""
    provider: str = Field(default="openai", description="AI provider (openai, lmstudio, ollama)")
    api_key: Optional[str] = Field(default="", description="API key (required for OpenAI, optional for others)")
    base_url: str = Field(default="https://api.openai.com/v1", description="API base URL")
    model_name: str = Field(default="gpt-4o-mini", description="Model name")
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0, description="Temperature for generation")
    max_tokens: Optional[int] = Field(default=32000, ge=1, description="Maximum tokens for generation")


class ConfigManager:
    """Manages application configuration using TinyDB."""

    def __init__(self, db_path: Optional[str] = None):
        """Initialize configuration manager.

        Args:
            db_path: Path to the TinyDB database file. If None, uses default.
        """
        if db_path is None:
            # Create data directory if it doesn't exist
            data_dir = Path("data")
            data_dir.mkdir(exist_ok=True)
            db_path = data_dir / "config.json"

        self.db_path = Path(db_path)
        self.db = TinyDB(self.db_path)
        self.config_table = self.db.table("config")

        # Initialize default config if it doesn't exist
        self._init_default_config()

    def _init_default_config(self) -> None:
        """Initialize default configuration from environment variables."""
        # Try to load from environment variables first (for backward compatibility)
        env_config = self._load_from_env()

        # Only set defaults if no config exists in DB
        if not self.get_model_config():
            if env_config:
                self.save_model_config(env_config)
            else:
                # Use hardcoded defaults
                default_config = ModelConfig(
                    api_key="",
                    base_url="https://api.openai.com/v1",
                    model_name="gpt-4o-mini",
                    temperature=0.7,
                    max_tokens=32000
                )
                self.save_model_config(default_config)

    def _load_from_env(self) -> Optional[ModelConfig]:
        """Load configuration from environment variables."""
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass

        api_key = os.getenv("OPENAI_API_KEY", "")
        base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        temperature = os.getenv("OPENAI_TEMPERATURE")
        max_tokens = os.getenv("OPENAI_MAX_TOKENS")

        if not api_key:
            return None

        try:
            temp_val = float(temperature) if temperature else 0.7
            tokens_val = int(max_tokens) if max_tokens else 32000

            return ModelConfig(
                api_key=api_key,
                base_url=base_url,
                model_name=model_name,
                temperature=temp_val,
                max_tokens=tokens_val
            )
        except ValueError:
            return None

    def save_model_config(self, config: ModelConfig) -> bool:
        """Save model configuration to database.

        Args:
            config: Model configuration to save

        Returns:
            True if successful, False otherwise
        """
        try:
            # Remove any existing model config
            self.config_table.remove(Query().type == "model")

            # Save new config
            self.config_table.insert({
                "type": "model",
                "config": config.model_dump()
            })
            return True
        except Exception:
            return False

    def get_model_config(self) -> Optional[ModelConfig]:
        """Get model configuration from database.

        Returns:
            ModelConfig if found, None otherwise
        """
        try:
            result = self.config_table.get(Query().type == "model")
            if result and "config" in result:
                return ModelConfig(**result["config"])
            return None
        except Exception:
            return None

    def update_model_config(self, updates: Dict[str, Any]) -> bool:
        """Update model configuration with partial updates.

        Args:
            updates: Dictionary of fields to update

        Returns:
            True if successful, False otherwise
        """
        try:
            current_config = self.get_model_config()
            if not current_config:
                return False

            # Create updated config
            current_data = current_config.model_dump()
            current_data.update(updates)

            # Validate and save
            updated_config = ModelConfig(**current_data)
            return self.save_model_config(updated_config)
        except Exception:
            return False

    def save_language_config(self, language: str) -> bool:
        """Save language configuration to database.

        Args:
            language: Language code (e.g., 'en', 'zh-CN')

        Returns:
            True if successful, False otherwise
        """
        try:
            # Remove any existing language config
            self.config_table.remove(Query().type == "language")

            # Save new language config
            self.config_table.insert({
                "type": "language",
                "language": language
            })
            return True
        except Exception:
            return False

    def get_language_config(self) -> Optional[str]:
        """Get language configuration from database.

        Returns:
            Language code if found, None otherwise
        """
        try:
            result = self.config_table.get(Query().type == "language")
            if result and "language" in result:
                return result["language"]
            return None
        except Exception:
            return None

    def save_dark_mode_config(self, dark_mode: bool) -> bool:
        """Save dark mode configuration to database.

        Args:
            dark_mode: Dark mode state (True for enabled, False for disabled)

        Returns:
            True if successful, False otherwise
        """
        try:
            # Remove any existing dark mode config
            self.config_table.remove(Query().type == "dark_mode")

            # Save new dark mode config
            self.config_table.insert({
                "type": "dark_mode",
                "dark_mode": dark_mode
            })
            return True
        except Exception as e:
            logger.error(f"Error saving dark mode config: {e}")
            return False

    def get_dark_mode_config(self) -> Optional[bool]:
        """Get dark mode configuration from database.

        Returns:
            Dark mode state if found, None otherwise
        """
        try:
            result = self.config_table.get(Query().type == "dark_mode")
            if result and "dark_mode" in result:
                return result["dark_mode"]
            return None
        except Exception:
            return None

    def export_config(self) -> Dict[str, Any]:
        """Export all configuration as dictionary.

        Returns:
            Dictionary containing all configuration
        """
        model_config = self.get_model_config()
        return {
            "model": model_config.model_dump() if model_config else None
        }

    def import_config(self, config_data: Dict[str, Any]) -> bool:
        """Import configuration from dictionary.

        Args:
            config_data: Dictionary containing configuration data

        Returns:
            True if successful, False otherwise
        """
        try:
            if "model" in config_data and config_data["model"]:
                model_config = ModelConfig(**config_data["model"])
                self.save_model_config(model_config)
            return True
        except Exception:
            return False


# Global configuration manager instance
_config_manager: Optional[ConfigManager] = None


def get_config_manager() -> ConfigManager:
    """Get the global configuration manager instance.

    Returns:
        ConfigManager instance
    """
    global _config_manager
    if _config_manager is None:
        _config_manager = ConfigManager()
    return _config_manager


def get_model_config() -> Optional[ModelConfig]:
    """Get the current model configuration.

    Returns:
        Current model configuration or None
    """
    return get_config_manager().get_model_config()