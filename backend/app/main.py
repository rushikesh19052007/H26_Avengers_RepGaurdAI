"""Main entrypoint for DepGuard AI FastAPI backend."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database schema
    from app.db.database import init_db
    init_db()
    print(f"[RepGuard AI] Backend initialized. Host={settings.host}:{settings.port}, Gemma Model={settings.gemma_model}")
    yield
    # Shutdown
    print("[RepGuard AI] Backend shutting down.")


app = FastAPI(
    title="RepGuard AI — Dependency Resilience Engine",
    description="Deterministic dependency scanning and Gemma 4 AI resilience analysis.",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for local development and Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API router
app.include_router(api_router)


@app.get("/")
def read_root():
    return {
        "service": "RepGuard AI Backend",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
        "health": "/api/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
