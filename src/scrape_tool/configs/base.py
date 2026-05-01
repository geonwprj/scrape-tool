from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List, Optional

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Base configuration
    SERVER_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    SERVER_MODE: str = "development"
    LOG_LEVEL: str = "INFO"
    ROOT_PATH: str = ""
    API_ROOT: str = "http://localhost:8000"
    
    # Database
    DATABASE_PATH: str = "./data/scraper.db"
    
    @property
    def DATABASE_URL(self) -> str:
        return f"sqlite+aiosqlite:///{self.DATABASE_PATH}"

    # App configuration (nested)
    class AppSettings(BaseSettings):
        ROOT_PATH: str = ""
        VERSION: str = "0.1.0"
        TITLE: str = "scrape-tool"
        DESCRIPTION: str = "Visual web scraper backend with BeautifulSoup and SQLite."

    @property
    def app(self) -> AppSettings:
        return self.AppSettings(ROOT_PATH=self.ROOT_PATH)

    # Github
    GITHUB_EMAIL: Optional[str] = None
    GITHUB_USER: Optional[str] = None
    GITHUB_PAT: Optional[str] = None
    GITHUB_REPO: Optional[str] = None

    # LLM
    LLM_HOST: Optional[str] = None
    LLM_PORT: Optional[int] = None
    LLM_API_KEY: Optional[str] = None
    LLM_MODEL: Optional[str] = None
    LLM_SECURE: bool = False
    PLAYWRIGHT_URL: Optional[str] = None

    # n8n
    N8N_HOST: Optional[str] = None
    N8N_PORT: Optional[int] = None
    N8N_SECURE: bool = True
    N8N_WF_PATH: str = "/webhook"
    CF_ZT_API_CLIENT_ID: Optional[str] = None
    CF_ZT_API_SECRET: Optional[str] = None
    # AI Analysis
    ANALYZE_PROMPT: str = ""
    SCRAPE_TOOL_WF_ID: Optional[str] = None
    SCRAPE_TOOL_WF_METHOD: str = "POST"

settings = Settings()
