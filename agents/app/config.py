import os
from dotenv import load_dotenv

load_dotenv()

# ── Provider selection ─────────────────────────────
MODEL_PROVIDER: str = os.getenv("MODEL_PROVIDER", "openai")

# ── Model names per tier ───────────────────────────
LARGE_MODEL: str = os.getenv("LARGE_MODEL", "gpt-4o")
MEDIUM_MODEL: str = os.getenv("MEDIUM_MODEL", "gpt-4o")
SMALL_MODEL: str = os.getenv("SMALL_MODEL", "gpt-4o-mini")

# ── Provider-specific keys / URLs ──────────────────
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

# ── Database ───────────────────────────────────────
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./pathai.db")

# ── Server ─────────────────────────────────────────
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))
