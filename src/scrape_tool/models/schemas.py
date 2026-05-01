from enum import Enum
from typing import List, Optional, Union, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class ExtractorType(str, Enum):
    TEXT = "text"
    ATTRIBUTE = "attribute"
    HTML = "html"
    NESTED = "nested"
    INDEX = "index"

class Extractor(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = None
    alias: str
    selector: str
    type: Optional[ExtractorType] = ExtractorType.TEXT
    attribute: Optional[str] = None
    regex: Optional[str] = None
    post_replace: Optional[List[Dict[str, str]]] = None # n8n's list of transforms
    is_array: bool = Field(default=False, alias="isArray")
    elements: Optional[List["Extractor"]] = None # n8n's children

class PageType(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    slug: Optional[str] = None
    name: str # pageTypeName in UI
    url: str # url template (with {{}} or {})
    query: Optional[Dict[str, str]] = None # URL params
    items: List[Extractor] # Replaces extractors
    to_traditional: bool = Field(default=False, alias="toTraditional")

class Profile(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    slug: Optional[str] = None
    name: str
    site_type: str = Field(..., alias="siteType") # novel, ecommerce
    pages: List[PageType] # Replaces pageTypes
    to_traditional: bool = Field(default=False, alias="toTraditional")

class ProfileUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = None
    slug: Optional[str] = None
    site_type: Optional[str] = Field(None, alias="siteType")
    pages: Optional[List[PageType]] = None
    to_traditional: Optional[bool] = Field(None, alias="toTraditional")

class ScrapeRequest(BaseModel):
    url: str
    extractors: List[Extractor]
    query: Optional[Dict[str, str]] = None
    to_traditional: bool = Field(default=False, alias="toTraditional")

class ProfileScrapeRequest(BaseModel):
    profile_id: str = Field(..., alias="profileId")
    page_type_id: str = Field(..., alias="pageTypeId")
    parameters: Optional[Dict[str, str]] = None
    to_traditional: Optional[bool] = Field(default=None, alias="toTraditional")

class ProxyRequest(BaseModel):
    url: str
