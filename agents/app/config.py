import os
from dotenv import load_dotenv

load_dotenv()

# ── Provider selection ─────────────────────────────
# Supported: "openai" | "ollama" | "huggingface" | "gemini"
MODEL_PROVIDER: str = os.getenv("MODEL_PROVIDER", "gemini")

# ── Model names per tier ───────────────────────────
LARGE_MODEL: str = os.getenv("LARGE_MODEL", "llama3")
MEDIUM_MODEL: str = os.getenv("MEDIUM_MODEL", "llama3")
SMALL_MODEL: str = os.getenv("SMALL_MODEL", "llama3")

# ── Provider-specific keys / URLs ──────────────────
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
HUGGINGFACE_API_KEY: str = os.getenv("HUGGINGFACE_API_KEY", "")
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# ── Database ───────────────────────────────────────
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./pathai.db")

# ── Server ─────────────────────────────────────────
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))
