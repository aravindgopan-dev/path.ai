# PATH.ai — Agents Module

LangGraph-powered AI agents for project planning.

## Setup

```bash
cd agents

# Create virtual environment
python -m venv venv
source venv/bin/activate      # Linux/Mac
# venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

## Running

```bash
# From inside agents/
python -m app.main
# or
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The server will start on **http://localhost:8000**.

## API Endpoints

| Method | Path         | Description                          |
|--------|--------------|--------------------------------------|
| POST   | `/architect` | Analyse a raw project idea           |
| POST   | `/blueprint` | Generate full project blueprint      |
| POST   | `/skills`    | Assess high-level conceptual skills  |
| POST   | `/roadmap`   | Generate ordered learning roadmap    |
| GET    | `/health`    | Health check                         |

## Client Connection

The Next.js client connects via the environment variable:

```
NEXT_PUBLIC_AGENTS_BASE_URL=http://localhost:8000
```

Add this to `client/.env.local`.
