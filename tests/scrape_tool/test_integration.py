import pytest
import json
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from src.scrape_tool.main import app
from src.scrape_tool.models.schemas import Profile, PageType, Extractor, ExtractorType
from src.scrape_tool.configs.database import get_db, Base

# Test database
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(TEST_DATABASE_URL)
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)

async def override_get_db():
    async with TestSessionLocal() as session:
        yield session

@pytest.fixture
async def client():
    # Initialize tables in-memory
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_full_profile_cycle(client):
    # 1. Create a Profile
    profile_id = "test-id-cycle"
    profile_data = {
        "id": profile_id,
        "name": "Test Site",
        "siteType": "blog",
        "pageTypes": [
            {
                "id": "list-page",
                "name": "Listing",
                "urlTemplate": "https://example.com/blog?p={page}",
                "extractors": [
                    {
                        "id": "e1",
                        "name": "titles",
                        "selector": "h2",
                        "type": "text",
                        "isArray": True
                    }
                ]
            }
        ]
    }
    
    response = await client.post("/api/v1/profiles/", json=profile_data)
    assert response.status_code == 200
    
    # 2. Get All Profiles
    response = await client.get("/api/v1/profiles/")
    assert response.status_code == 200
    profiles = response.json()
    assert any(p["id"] == profile_id for p in profiles)

    # 3. Get Single Profile
    response = await client.get(f"/api/v1/profiles/{profile_id}")
    assert response.status_code == 200
    profile = response.json()
    assert profile["id"] == profile_id

@pytest.mark.asyncio
async def test_patch_profile(client):
    # 1. Create a Profile
    profile_id = "patch-test-id"
    profile_data = {
        "id": profile_id,
        "name": "Original Name",
        "siteType": "original",
        "pageTypes": []
    }
    await client.post("/api/v1/profiles/", json=profile_data)

    # 2. Patch only the name
    patch_data = {"name": "Updated Name"}
    response = await client.patch(f"/api/v1/profiles/{profile_id}", json=patch_data)
    assert response.status_code == 200
    
    updated_profile = response.json()
    assert updated_profile["name"] == "Updated Name"
    assert updated_profile["siteType"] == "original" # Should be unchanged

from unittest.mock import patch

@pytest.mark.asyncio
async def test_full_profile_scrape_flow(client):
    # 1. Create a Profile
    profile_id = "test-id-scrape"
    profile_data = {
        "id": profile_id,
        "name": "Test Site",
        "siteType": "news",
        "pageTypes": [
            {
                "id": "article-page",
                "name": "Article",
                "urlTemplate": "https://test.local/article/{slug}",
                "extractors": [
                    {
                        "id": "e_title",
                        "name": "title",
                        "selector": "h1",
                        "type": "text"
                    }
                ]
            }
        ]
    }
    
    await client.post("/api/v1/profiles/", json=profile_data)

    # 2. Mock the fetch_html and test the scrape/profile endpoint
    mock_html = "<html><body><h1>Scraped Title</h1></body></html>"
    
    from unittest.mock import AsyncMock
    with patch("src.scrape_tool.tools.scraper.ScraperService.fetch_html", new_callable=AsyncMock) as mocked_fetch:
        mocked_fetch.return_value = mock_html
        
        # New GET format with query parameters
        params = {
            "params_profile_id": profile_id,
            "params_page_type_id": "article-page",
            "parameters": json.dumps({"slug": "hello-world"})
        }
        
        response = await client.get("/api/v1/scrape/profile", params=params)
        
    assert response.status_code == 200
    data = response.json()
    assert data["url"] == "https://test.local/article/hello-world"
    assert data["data"]["title"] == "Scraped Title"
