from fastapi import APIRouter, Depends, HTTPException, status, Query, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any, Optional
from src.scrape_tool.configs.database import get_db
from src.scrape_tool.models.db_models import Profile as dbProfile
from src.scrape_tool.models.schemas import Extractor, ScrapeRequest, ProfileScrapeRequest
from src.scrape_tool.tools.scraper import ScraperService
from src.scrape_tool.tools.proxy import ProxyService
from src.scrape_tool.configs.base import settings
import litellm
import json
import re

router = APIRouter(tags=["scrape"])

@router.post("/scrape")
async def generic_scrape(request: ScrapeRequest):
    scraper = ScraperService()
    try:
        # Pass query context for variable interpolation
        data = await scraper.scrape(request.url, request.extractors, request.query, to_traditional=request.to_traditional)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/scrape/profile")
async def profile_scrape(
    profile_slug: str = Query(..., alias="params_profile_slug"),
    page_type_slug: str = Query(..., alias="params_page_type_slug"),
    parameters: Optional[str] = Query(None, description="JSON string of parameters"),
    to_traditional: bool = Query(False, alias="toTraditional"),
    db: AsyncSession = Depends(get_db)
):
    # Lookup by site slug and page type slug
    result = await db.execute(
        select(dbProfile)
        .where(dbProfile.slug == profile_slug)
        .where(dbProfile.page_type == page_type_slug)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail=f"Profile '{profile_slug}' with page type '{page_type_slug}' not found")
    
    # Finding page type by slug in the page_types JSON list
    page_types_list = profile.page_types if isinstance(profile.page_types, list) else []
    page_type = next((pt for pt in page_types_list if pt.get("slug") == page_type_slug), None)
    
    if not page_type:
        raise HTTPException(status_code=404, detail=f"Page type slug '{page_type_slug}' not found for profile '{profile_slug}'")

    url = page_type.get("url", "")
    params_dict = json.loads(parameters) if parameters else {}
    
    for key, value in params_dict.items():
        # Handle {key}, {{key}}, or any depth of braces
        url = re.sub(r'\{+' + re.escape(key) + r'\}+', str(value), url)

    scraper = ScraperService()
    extractors = [Extractor(**ext) for ext in page_type.get("items", [])]
    
    try:
        # Check if requested via query or set at the profile level
        effective_to_traditional = to_traditional or profile.to_traditional
        data = await scraper.scrape(url, extractors, to_traditional=effective_to_traditional)
        return {"data": data, "url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/scrape/{profile_slug}/{page_type_slug}")
async def dynamic_profile_scrape(
    profile_slug: str,
    page_type_slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    # Lookup profile by site slug and page type slug
    result = await db.execute(
        select(dbProfile)
        .where(dbProfile.slug == profile_slug)
        .where(dbProfile.page_type == page_type_slug)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail=f"Profile '{profile_slug}' with page type '{page_type_slug}' not found")
    
    # Finding page type by slug in the page_types JSON list
    page_types_list = profile.page_types if isinstance(profile.page_types, list) else []
    page_type = next((pt for pt in page_types_list if pt.get("slug") == page_type_slug), None)
    
    if not page_type:
        raise HTTPException(status_code=404, detail=f"Page type '{page_type_slug}' not found for profile '{profile_slug}'")

    url = page_type.get("url", "")
    
    # Auto-consume all standard query parameters as variables
    query_context = dict(request.query_params)
    
    # Apply variable interpolation to the URL
    for key, value in query_context.items():
        # Handle {key}, {{key}}, or any depth of braces
        url = re.sub(r'\{+' + re.escape(key) + r'\}+', str(value), url)

    scraper = ScraperService()
    extractors = [Extractor(**ext) for ext in page_type.get("items", [])]
    
    # Check if requested via query or set at the profile level
    to_traditional_flag = request.query_params.get("toTraditional", "").lower() == "true" or profile.to_traditional
    
    try:
        data = await scraper.scrape(url, extractors, query_context, to_traditional=to_traditional_flag)
        return {"data": data, "url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/proxy")
async def proxy_resource(request: Request, url: str = Query(None)):
    if not url:
        return Response(content="Missing URL parameter", status_code=400)
        
    proxy = ProxyService()
    try:
        # Determine the effective API root for rebasing based on the incoming request
        # This ensures that assets are proxied through the same endpoint the user is visiting
        protocol = "https" if request.url.scheme == "https" else "http"
        api_root = f"{protocol}://{request.url.netloc}"
        
        # get_proxied_resource handles HTML processing and returns a Response object
        return await proxy.get_proxied_resource(url, api_root=api_root)
    except Exception as e:
        # Final safety fallback with detailed logging
        logger.error(f"Proxy route error: {str(e)}")
        logger.error(traceback.format_exc())
        return Response(content=f"Proxy failure: {str(e)}", status_code=500)

import httpx
import logging
import traceback

logger = logging.getLogger(__name__)

@router.post("/analyze")
async def analyze_page(request: Dict[str, Any]):
    url = request.get("url", "")
    site_type = request.get("siteType", "auto")
    page_type = request.get("pageType", "auto-detect")
    
    logger.info(f"Analyzing page: {url} (site: {site_type}, page: {page_type})")
    
    if not url:
        raise HTTPException(status_code=400, detail="URL is required for analysis")
    
    # Construct n8n webhook URL
    try:
        protocol = "https" if settings.N8N_SECURE else "http"
        base_url = f"{protocol}://{settings.N8N_HOST}"
        if settings.N8N_PORT and settings.N8N_PORT not in [80, 443]:
            base_url += f":{settings.N8N_PORT}"
        
        webhook_url = f"{base_url}{settings.N8N_WF_PATH}/{settings.SCRAPE_TOOL_WF_ID}"
        logger.info(f"n8n Webhook URL: {webhook_url}")
        
        # Payload as specified by user (single object, not list)
        payload = {
            "url": url,
            "site_type": site_type,
            "page_type": page_type,
            "analyze_prompt": settings.ANALYZE_PROMPT,
            "llm_model": settings.LLM_MODEL,
            "llm_host": settings.LLM_HOST,
            "llm_port": settings.LLM_PORT,
            "llm_api_key": settings.LLM_API_KEY,
            "llm_secure": settings.LLM_SECURE
        }
        
        headers = {
            "Content-Type": "application/json"
        }
        
        # Add Cloudflare Access headers if present
        if settings.CF_ZT_API_CLIENT_ID and settings.CF_ZT_API_SECRET:
            headers["CF-Access-Client-Id"] = settings.CF_ZT_API_CLIENT_ID
            headers["CF-Access-Client-Secret"] = settings.CF_ZT_API_SECRET
        
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            response = await client.request(
                method=settings.SCRAPE_TOOL_WF_METHOD or "POST",
                url=webhook_url,
                json=payload,
                headers=headers
            )
            logger.info(f"n8n Response status: {response.status_code}")
            response.raise_for_status()
            data = response.json()
            
            # n8n returns a list of objects, we take the first one
            if isinstance(data, list) and len(data) > 0:
                result = data[0]
            else:
                result = data
            
            if not isinstance(result, dict):
                logger.error(f"Unexpected n8n result type: {type(result)}")
                raise ValueError(f"Unexpected n8n result type: {type(result)}")

            # Return everything n8n gave us, it now matches our internal schema
            return {
                "items": result.get("items", []),
                "template": {
                    "url": result.get("url"),
                    "query": result.get("query"),
                    "site": result.get("site"),
                    "page": result.get("page")
                }
            }
            
    except httpx.HTTPStatusError as e:
        error_msg = f"n8n Analysis failed: {e.response.status_code}"
        try:
            error_data = e.response.json()
            if "message" in error_data:
                error_msg = f"n8n logic error: {error_data['message']}"
        except:
            pass
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)
    except Exception as e:
        logger.error(f"n8n Analysis Error: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"n8n Analysis failed: {str(e)}")
