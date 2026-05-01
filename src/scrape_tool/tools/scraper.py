import re
import asyncio
from typing import List, Any, Dict, Optional, Union
from bs4 import BeautifulSoup, Tag
from playwright.async_api import async_playwright
from src.scrape_tool.configs.base import settings
from src.scrape_tool.models.schemas import Extractor, ExtractorType

class ScraperService:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

    async def fetch_html(self, url: str) -> str:
        async with async_playwright() as p:
            browser = None
            try:
                # TIER 1: Remote Browser via Traefik (CDP)
                if settings.PLAYWRIGHT_URL:
                    try:
                        import logging
                        logger = logging.getLogger("uvicorn.error")
                        logger.info(f"Attempting remote Playwright connection: {settings.PLAYWRIGHT_URL}")
                        browser = await p.chromium.connect_over_cdp(settings.PLAYWRIGHT_URL, timeout=10000)
                    except Exception as e:
                        logger.warning(f"Remote Playwright failed: {str(e)}. Falling back to local browser.")
                        browser = None

                # TIER 2: Local Browser (Fallback)
                if not browser:
                    browser = await p.chromium.launch(headless=True)
                
                # Use a standard desktop viewport to trigger responsive elements
                context = await browser.new_context(
                    user_agent=self.headers["User-Agent"],
                    viewport={"width": 1280, "height": 800}
                )
                page = await context.new_page()
                
                # Navigate and wait for initial load
                await page.goto(url, wait_until="load", timeout=30000)
                
                # Force trigger lazy-loading by scrolling
                # We scroll in chunks to ensure Intermediate elements are triggered
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
                await asyncio.sleep(0.5)
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(0.5)
                await page.evaluate("window.scrollTo(0, 0)")
                
                # Wait for final network idle
                await page.wait_for_load_state("networkidle")
                
                content = await page.content()
                return content
            except Exception as e:
                import logging
                logger = logging.getLogger("uvicorn.error")
                logger.error(f"Ultimate fetch failure: {type(e).__name__}: {str(e)}")
                raise Exception(f"Failed to fetch content after all attempts: {str(e)}")
            finally:
                if browser:
                    await browser.close()

    def extract_single(self, soup: Union[BeautifulSoup, Tag], extractor: Extractor, context_data: Dict[str, Any] = None) -> Any:
        # Recursive case for nested
        if (extractor.type == ExtractorType.NESTED or extractor.elements) and extractor.elements:
            return self.execute_extractors(soup, extractor.elements, context_data)

        # Single element extraction
        value = ""
        if extractor.type == ExtractorType.TEXT:
            value = soup.get_text(strip=True)
        elif extractor.type == ExtractorType.ATTRIBUTE and extractor.attribute:
            value = soup.get(extractor.attribute, "")
        elif extractor.type == ExtractorType.HTML:
            value = str(soup)
        elif extractor.type == ExtractorType.INDEX:
            value = str(context_data.get("_index", ""))

        # Regex post-processing (REMOVED - now handled in post_replace for better sequencing)

        # Post-replace (prefix/suffix/regex/replace + interpolation)
        if extractor.post_replace and value:
            for transform in extractor.post_replace:
                # 1. Handle Interpolation if context_data is provided
                def interpolate(s: str):
                    if not context_data: return s
                    def repl(match):
                        var = match.group(1)
                        # Check context_data, then nested query if available
                        val = context_data.get(var)
                        if val is None and "query" in context_data:
                            val = context_data["query"].get(var)
                        return str(val) if val is not None else match.group(0)
                    return re.sub(r'\{\{(.*?)\}\}', repl, s)

                if "^" in transform:
                    prefix = interpolate(transform["^"])
                    value = f"{prefix}{value}"
                elif "$" in transform:
                    suffix = interpolate(transform["$"])
                    value = f"{value}{suffix}"
                elif "regex" in transform:
                    pattern = transform["regex"]
                    try:
                        match = re.search(pattern, value)
                        if match:
                            value = match.group(1) if match.groups() else match.group(0)
                    except re.error as e:
                        print(f"Regex transform error: {e}")
                elif "replace" in transform and "with" in transform:
                    pattern = transform["replace"]
                    replacement = interpolate(transform["with"])
                    try:
                        value = re.sub(pattern, replacement, value)
                    except re.error:
                        value = value.replace(pattern, replacement)

        return value

    def execute_extractors(self, context: Union[BeautifulSoup, Tag], extractors: List[Extractor], context_data: Dict[str, Any] = None) -> Dict[str, Any]:
        result = {}
        # Ensure context_data is at least an empty dict for nested lookups
        if context_data is None: context_data = {}
        
        for ext in extractors:
            # 1. IGNORE: If selector is empty, skip this item entirely
            if not ext.selector:
                continue

            # 2. SUPPORT SELF-REFERENCING: If selector is '.', use current context
            if ext.selector == ".":
                elements = [context]
            else:
                elements = context.select(ext.selector)
            
            if not elements:
                result[ext.alias] = [] if ext.is_array else None
                continue

            # 3. EXTRACTION LOGIC
            if ext.is_array:
                if ext.type == 'nested':
                    # Support nested list extraction with auto-indexing
                    results = []
                    for i, el in enumerate(elements):
                        # Pass the current index (1-based) in context_data
                        item = self.execute_extractors(el, ext.elements or [], {**context_data, **result, "_index": i + 1})
                        if isinstance(item, dict):
                            # Ensure index is present for backward compatibility or if not explicitly extracted
                            if "index" not in item:
                                item["index"] = i + 1
                        results.append(item)
                    result[ext.alias] = results
                else:
                    # Support flat list extraction (e.g. array of strings)
                    # Pass context_data for variable interpolation
                    current_context = {**context_data, **result}
                    result[ext.alias] = [
                        self.extract_single(el, ext, current_context)
                        for el in elements
                    ]
            else:
                # Support single element extraction
                el = elements[0]
                current_context = {**context_data, **result}
                result[ext.alias] = self.extract_single(el, ext, current_context)

        return result

    async def scrape(self, url: str, extractors: List[Extractor], query: Dict[str, Any] = None, to_traditional: bool = False) -> Dict[str, Any]:
        html = await self.fetch_html(url)
        soup = BeautifulSoup(html, "lxml")
        context_data = {"url": url, "query": query or {}}
        result = self.execute_extractors(soup, extractors, context_data)
        
        if to_traditional:
            from opencc import OpenCC
            cc = OpenCC('s2t') # simplified to traditional
            result = self._convert_recursive(result, cc)
            
        return result

    def _convert_recursive(self, data: Any, cc: Any) -> Any:
        if isinstance(data, str):
            return cc.convert(data)
        elif isinstance(data, list):
            return [self._convert_recursive(item, cc) for item in data]
        elif isinstance(data, dict):
            return {k: self._convert_recursive(v, cc) for k, v in data.items()}
        return data
