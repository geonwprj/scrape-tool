import httpx
import asyncio
import re
import mimetypes
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from fastapi import Response
from src.scrape_tool.configs.base import settings

class ProxyService:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

    async def get_proxied_resource(self, url: str, api_root: str = None) -> Response:
        # Basic URL validation
        if not url or not url.startswith(('http://', 'https://')):
             return Response(content="Invalid URL provided.", status_code=400)

        # Detect if we are fetching HTML or an asset
        # We need to send correct Referer for assets to bypass anti-hotlink
        request_headers = self.headers.copy()
        parsed_url = urlparse(url)
        request_headers["Referer"] = f"{parsed_url.scheme}://{parsed_url.netloc}/"

        # First, we check the content type using a lightweight client
        async with httpx.AsyncClient(headers=request_headers, follow_redirects=True, timeout=10.0) as client:
            try:
                resp = await client.get(url, follow_redirects=True)
                content_type = resp.headers.get("Content-Type", "").lower()
            except Exception as e:
                return Response(status_code=502, content=f"Proxy connection failed: {str(e)}")

            # Case 1: It's HTML -> Use Playwright for full JS rendering
            if "text/html" in content_type:
                from playwright.async_api import async_playwright
                
                async with async_playwright() as p:
                    browser = None
                    try:
                        # TIER 1: Remote Browser via Traefik (CDP)
                        if settings.PLAYWRIGHT_URL:
                            try:
                                import logging
                                logger = logging.getLogger("uvicorn.error")
                                logger.info(f"Proxy: Attempting remote Playwright: {settings.PLAYWRIGHT_URL}")
                                browser = await p.chromium.connect_over_cdp(settings.PLAYWRIGHT_URL, timeout=10000)
                            except Exception as e:
                                logger.warning(f"Proxy: Remote Playwright failed: {str(e)}. Using local fallback.")
                                browser = None

                        # TIER 2: Local Browser (Fallback)
                        if not browser:
                            browser = await p.chromium.launch(headless=True)
                        
                        # Use a large enough viewport to trigger desktop layouts
                        context = await browser.new_context(
                            user_agent=self.headers["User-Agent"],
                            viewport={"width": 1280, "height": 1000}
                        )
                        page = await context.new_page()
                        
                        # Navigate and scroll to trigger lazy loading
                        await page.goto(url, wait_until="load", timeout=30000)
                        await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
                        await asyncio.sleep(0.5)
                        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        await asyncio.sleep(0.5)
                        await page.evaluate("window.scrollTo(0, 0)")
                        await page.wait_for_load_state("networkidle")
                        
                        processed_html = self._process_html(await page.content(), url, api_root)
                        return Response(content=processed_html, media_type="text/html")
                    except Exception as e:
                        import logging
                        logger = logging.getLogger("uvicorn.error")
                        logger.error(f"Proxy Playwright Ultimate Failure: {type(e).__name__}: {str(e)}")
                        # Last resort: Fallback to the original content if all browser attempts fail
                        html = resp.content.decode("utf-8", errors="ignore")
                        processed_html = self._process_html(html, url, api_root)
                        return Response(content=processed_html, media_type="text/html")
                    finally:
                        if browser:
                            await browser.close()

            # Case 2: It's CSS -> Rebase contents
            if "text/css" in content_type:
                try:
                    css_content = resp.content.decode("utf-8", errors="ignore")
                    processed_css = self._rebase_css(css_content, url, api_root)
                    return Response(
                        content=processed_css,
                        media_type="text/css",
                        headers={"Access-Control-Allow-Origin": "*"}
                    )
                except Exception:
                    pass

            # Case 3: It's an asset (Image, Font, etc.) -> return original content
            return Response(
                content=resp.content, 
                media_type=content_type,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "max-age=3600"
                }
            )

    def _rebase_css(self, css: str, base_url: str, api_root: str) -> str:
        """Rebase URLs inside CSS content (style tags or .css files)"""
        import logging
        logger = logging.getLogger("uvicorn.error")
        
        proxy_prefix = f"{api_root}/api/v1/proxy?url="
        
        def replace_url(match):
            quote = match.group(1) or ""
            url_val = match.group(2).strip("\"' ")
            
            if url_val.startswith(("data:", "javascript:", "#")):
                return match.group(0)
            
            absolute_url = urljoin(base_url, url_val)
            return f"url({quote}{proxy_prefix}{absolute_url}{quote})"
            
        # 1. Rebase url(...)
        url_pattern = re.compile(r'url\((["\']?)([^)]+)\1\)', re.IGNORECASE)
        css = url_pattern.sub(replace_url, css)
        
        # 2. Rebase @import
        import_pattern = re.compile(r'@import\s+(["\'])([^"\']+)\1', re.IGNORECASE)
        def replace_import(match):
            quote = match.group(1)
            url_val = match.group(2)
            if url_val.startswith(("http://", "https://")):
                 absolute_url = url_val
            else:
                 absolute_url = urljoin(base_url, url_val)
            return f'@import {quote}{proxy_prefix}{absolute_url}{quote}'
        
        css = import_pattern.sub(replace_import, css)
        
        return css

    def _process_html(self, html: str, base_url: str, api_root: str = None) -> str:
        # Use provided api_root, fallback to settings, then to empty (relative)
        effective_api_root = api_root or settings.API_ROOT or ""
        
        soup = BeautifulSoup(html, "lxml")
        
        # Inject <base> tag to help with relative paths for assets the rebaser misses
        if not soup.head:
            head = soup.new_tag("head")
            if soup.html:
                soup.html.insert(0, head)
            else:
                soup.insert(0, head)
        
        base_tag = soup.new_tag("base", href=base_url)
        soup.head.insert(0, base_tag)

        # Rebase relative URLs and ROUTE THEM THROUGH OUR PROXY to avoid CORS
        # Tag/Attribute mapping for comprehensive rebasing
        tag_map = {
            "img": ["src", "data-src", "data-original", "data-src-original", "data-lazy-src"],
            "script": ["src"],
            "link": ["href"],
            "form": ["action"],
            "a": ["href"],
            "source": ["src", "srcset"],
            "video": ["src", "poster"],
            "audio": ["src"],
            "iframe": ["src"]
        }

        for tag_name, attrs in tag_map.items():
            for tag in soup.find_all(tag_name):
                for attr in attrs:
                    val = tag.get(attr)
                    if not val:
                        continue
                        
                    if val.startswith(("javascript:", "data:", "#")):
                        continue

                    absolute_url = urljoin(base_url, val)
                    
                    # Sanity check: If the URL is already absolute and matches the proxy pattern, don't double-proxy
                    if "/api/v1/proxy?url=" in val:
                        tag[attr] = val
                        continue
                        
                    # Rewrite to use our proxy endpoint
                    # USE ABSOLUTE API_ROOT to prevent the <base> tag from hijacking the path
                    proxy_prefix = f"{effective_api_root}/api/v1/proxy?url="
                    tag[attr] = f"{proxy_prefix}{absolute_url}"

        # CSS Regex Rebasing for style attributes (background images)
        for tag in soup.find_all(style=True):
            style = tag["style"]
            tag["style"] = self._rebase_css(style, base_url, effective_api_root)

        # Rebase <style> blocks
        for tag in soup.find_all("style"):
            if tag.string:
                tag.string = self._rebase_css(tag.string, base_url, effective_api_root)

        # Inject Picker Script and CSS
        picker_style = soup.new_tag("style")
        picker_style.string = """
            .scraper-highlight {
                outline: 2px solid #3b82f6 !important;
                background-color: rgba(59, 130, 246, 0.2) !important;
                cursor: crosshair !important;
            }
        """
        
        picker_script = soup.new_tag("script")
        picker_script.string = f"""
            let pickerActive = false;
            let hoveredEl = null;

            window.addEventListener('message', (e) => {{
                if (e.data.type === 'TOGGLE_PICKER') {{
                    pickerActive = e.data.active;
                    if (!pickerActive && hoveredEl) {{
                        hoveredEl.classList.remove('scraper-highlight');
                        hoveredEl = null;
                    }}
                }}
            }});

            document.addEventListener('mouseover', (e) => {{
                if (!pickerActive) return;
                e.stopPropagation();
                if (hoveredEl) hoveredEl.classList.remove('scraper-highlight');
                hoveredEl = e.target;
                hoveredEl.classList.add('scraper-highlight');
            }}, true);

            document.addEventListener('mouseout', (e) => {{
                if (!pickerActive) return;
                if (hoveredEl) hoveredEl.classList.remove('scraper-highlight');
                hoveredEl = null;
            }}, true);

            document.addEventListener('click', (e) => {{
                if (pickerActive) {{
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const selector = getCssSelector(e.target);
                    window.parent.postMessage({{ type: 'ELEMENT_PICKED', selector }}, '*');
                    
                    pickerActive = false;
                    if (hoveredEl) hoveredEl.classList.remove('scraper-highlight');
                }} else {{
                    const link = e.target.closest('a');
                    if (link) {{
                        const href = link.getAttribute('href');
                        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {{
                            e.preventDefault();
                            e.stopPropagation();
                            try {{
                                // In the proxied page, the href is already a proxy link
                                // We need to extract the original URL or let the proxy handle navigation
                                const proxyUrl = new URL(href, window.location.origin);
                                const originalUrl = proxyUrl.searchParams.get('url');
                                if (originalUrl) {{
                                    window.parent.postMessage({{ type: 'NAVIGATE', url: originalUrl }}, '*');
                                }} else {{
                                    const absoluteUrl = new URL(href, '{base_url}').href;
                                    window.parent.postMessage({{ type: 'NAVIGATE', url: absoluteUrl }}, '*');
                                }}
                            }} catch (err) {{
                                console.error('Invalid URL', href);
                            }}
                        }}
                    }}
                }}
            }}, true);

            function getCssSelector(el) {{
                if (!(el instanceof Element)) return;
                const path = [];
                while (el.nodeType === Node.ELEMENT_NODE) {{
                    let selector = el.nodeName.toLowerCase();
                    if (el.id) {{
                        selector += '#' + el.id;
                        path.unshift(selector);
                        break;
                    }} else {{
                        let sib = el, nth = 1;
                        while (sib = sib.previousElementSibling) {{
                            if (sib.nodeName.toLowerCase() == selector) nth++;
                        }}
                        if (nth != 1) selector += ":nth-of-type("+nth+")";
                    }}
                    path.unshift(selector);
                    el = el.parentNode;
                }}
                return path.join(" > ");
            }}
        """

        if soup.body:
            soup.body.append(picker_style)
            soup.body.append(picker_script)
        else:
            soup.append(picker_style)
            soup.append(picker_script)

        return str(soup)
