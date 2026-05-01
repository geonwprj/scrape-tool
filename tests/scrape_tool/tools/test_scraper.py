import pytest
from bs4 import BeautifulSoup
from src.scrape_tool.tools.scraper import ScraperService
from src.scrape_tool.models.schemas import Extractor, ExtractorType

def test_extract_text():
    scraper = ScraperService()
    html = "<div><span class='title'>Hello World</span></div>"
    soup = BeautifulSoup(html, "lxml")
    extractor = Extractor(
        id="1", name="title", selector=".title", type=ExtractorType.TEXT
    )
    result = scraper.execute_extractors(soup, [extractor])
    assert result["title"] == "Hello World"

def test_extract_attribute():
    scraper = ScraperService()
    html = "<div><a href='https://example.com' class='link'>Click me</a></div>"
    soup = BeautifulSoup(html, "lxml")
    extractor = Extractor(
        id="2", name="link", selector=".link", type=ExtractorType.ATTRIBUTE, attribute="href"
    )
    result = scraper.execute_extractors(soup, [extractor])
    assert result["link"] == "https://example.com"

def test_extract_array():
    scraper = ScraperService()
    html = "<ul><li>Item 1</li><li>Item 2</li></ul>"
    soup = BeautifulSoup(html, "lxml")
    extractor = Extractor(
        id="3", name="items", selector="li", type=ExtractorType.TEXT, isArray=True
    )
    result = scraper.execute_extractors(soup, [extractor])
    assert len(result["items"]) == 2
    assert result["items"][0] == "Item 1"
    assert result["items"][1] == "Item 2"

def test_extract_nested():
    scraper = ScraperService()
    html = """
    <div class="product">
        <h2 class="name">Product A</h2>
        <span class="price">10.00</span>
    </div>
    """
    soup = BeautifulSoup(html, "lxml")
    child1 = Extractor(id="c1", name="name", selector=".name", type=ExtractorType.TEXT)
    child2 = Extractor(id="c2", name="price", selector=".price", type=ExtractorType.TEXT)
    
    extractor = Extractor(
        id="4", name="product", selector=".product", type=ExtractorType.NESTED, 
        children=[child1, child2]
    )
    result = scraper.execute_extractors(soup, [extractor])
    assert result["product"]["name"] == "Product A"
    assert result["product"]["price"] == "10.00"

def test_regex_post_processing():
    scraper = ScraperService()
    html = "<span>Order #12345</span>"
    soup = BeautifulSoup(html, "lxml")
    extractor = Extractor(
        id="5", name="order_id", selector="span", type=ExtractorType.TEXT, regex=r"#(\d+)"
    )
    result = scraper.execute_extractors(soup, [extractor])
    assert result["order_id"] == "12345"
