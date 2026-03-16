"""FastAPI entry-point for the agents server."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import HOST, PORT
from app.db.database import init_db
from app.routers import architect, skills, roadmap, projects, tutor
from app.routers import blueprint as blueprint_router
from app.routers import coding as coding_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Create DB tables on startup."""
    init_db()
    yield


app = FastAPI(
    title="PATH.ai Agents",
    description="LangGraph-powered AI agents for project planning",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(architect.router, tags=["architect"])
app.include_router(blueprint_router.router, tags=["blueprint"])
app.include_router(skills.router, tags=["skills"])
app.include_router(roadmap.router, tags=["roadmap"])
app.include_router(tutor.router, tags=["tutor"])
app.include_router(coding_router.router, tags=["coding"])
app.include_router(projects.router, tags=["projects"])


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
