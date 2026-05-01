import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from src.scrape_tool.configs.base import settings

# Database URL
DATABASE_URL = settings.DATABASE_URL

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=False)

# Session factory
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with SessionLocal() as session:
        yield session
