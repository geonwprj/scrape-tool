from fastapi import FastAPI
from src.scrape_tool.routes import profiles, scrape, chat
from src.scrape_tool.configs.database import engine, Base
from src.scrape_tool.configs.base import settings
import contextlib

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Verify AI Analysis Prompt Configuration
    if settings.ANALYZE_PROMPT:
        print(f"🚀 AI Analysis Prompt loaded successfully ({len(settings.ANALYZE_PROMPT)} chars)")
    else:
        print("⚠️ WARNING: ANALYZE_PROMPT not found or empty in .env!")
    
    yield

app = FastAPI(
    title=settings.app.TITLE,
    description=settings.app.DESCRIPTION,
    version=settings.app.VERSION,
    root_path=settings.app.ROOT_PATH,
    docs_url="/docs",
    redoc_url="/redoc",
    swagger_ui_parameters={
        "syntaxHighlight.theme": "monokai",
        "persistAuthorization": True,
        "displayRequestDuration": True,
    },
    lifespan=lifespan,
)

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include routers with /api/v1 prefix
app.include_router(profiles.router, prefix="/api/v1")
app.include_router(scrape.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    # Use 0.0.0.0 to ensure accessibility from proxy
    uvicorn.run(app, host="0.0.0.0", port=settings.API_PORT)
