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

from app.config import (
    MODEL_PROVIDER,
    LARGE_MODEL,
    MEDIUM_MODEL,
    SMALL_MODEL,
    OPENAI_API_KEY,
    GEMINI_API_KEY,
    HUGGINGFACE_API_KEY,
    OLLAMA_BASE_URL,
)


def _build_llm(model_name: str, temperature: float) -> BaseChatModel:
    """Return a chat-model instance for the configured provider."""
    provider = MODEL_PROVIDER.lower().strip()

    if provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=model_name,
            temperature=temperature,
            api_key=OPENAI_API_KEY,
        )

    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=model_name,
            temperature=temperature,
            google_api_key=GEMINI_API_KEY,
        )

    if provider == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(
            model=model_name,
            temperature=temperature,
            base_url=OLLAMA_BASE_URL,
        )

    if provider == "huggingface":
        from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint

        endpoint = HuggingFaceEndpoint(
            repo_id=model_name,
            temperature=temperature,
            huggingfacehub_api_token=HUGGINGFACE_API_KEY,
        )
        return ChatHuggingFace(llm=endpoint)

    raise ValueError(
        f"Unknown MODEL_PROVIDER '{MODEL_PROVIDER}'. "
        "Set MODEL_PROVIDER to 'openai', 'gemini', 'ollama', or 'huggingface'."
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
