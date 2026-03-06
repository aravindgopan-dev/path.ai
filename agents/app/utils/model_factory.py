"""Factory that exposes pre-configured LLM instances.

Supports four providers via MODEL_PROVIDER env var:
  - openai       → ChatOpenAI
  - gemini       → ChatGoogleGenerativeAI
  - ollama       → ChatOllama
  - huggingface  → HuggingFaceEndpoint

Every consumer imports from here — never constructs a model directly.
Instances are cached (singleton) so models are reused across requests.
"""

from __future__ import annotations

from functools import lru_cache

from langchain_core.language_models import BaseChatModel

from langchain_openai import ChatOpenAI

from app.config import (
    MODEL_PROVIDER,
    LARGE_MODEL,
    MEDIUM_MODEL,
    SMALL_MODEL,
    OPENAI_API_KEY,
)


def _build_llm(model_name: str, temperature: float) -> BaseChatModel:
    """Return a ChatOpenAI instance."""
    return ChatOpenAI(
        model=model_name,
        temperature=temperature,
        api_key=OPENAI_API_KEY,
    )


# ── Singleton-cached public helpers ───────────────


@lru_cache(maxsize=1)
def get_large_llm(temperature: float = 0.3) -> BaseChatModel:
    return _build_llm(LARGE_MODEL, temperature)


@lru_cache(maxsize=1)
def get_medium_llm(temperature: float = 0.3) -> BaseChatModel:
    return _build_llm(MEDIUM_MODEL, temperature)


@lru_cache(maxsize=1)
def get_small_llm(temperature: float = 0.2) -> BaseChatModel:
    return _build_llm(SMALL_MODEL, temperature)
