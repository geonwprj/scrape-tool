import pytest
from httpx import ASGITransport, AsyncClient
from src.scrape_tool.main import app

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

@pytest.mark.asyncio
async def test_api_prefix():
    from src.scrape_tool.main import lifespan
    async with lifespan(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/api/v1/profiles/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
