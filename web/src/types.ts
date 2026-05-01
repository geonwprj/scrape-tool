export type ExtractorType = 'text' | 'attribute' | 'html' | 'nested' | 'index';

export interface Extractor {
  id?: string;
  alias: string;
  selector: string;
  type: ExtractorType;
  attribute?: string;
  regex?: string;
  post_replace?: Record<string, string>[];
  isArray?: boolean;
  elements?: Extractor[];
}

export interface PageType {
  id: string;
  slug?: string;
  name: string; // display name (Schema Type)
  url: string; // url template
  query?: Record<string, string>;
  items: Extractor[];
  toTraditional?: boolean;
}

export interface Profile {
  id: string;
  slug?: string;
  name: string;
  siteType: string;
  pages: PageType[];
  toTraditional?: boolean;
}

export interface ScrapeRequest {
  url: string;
  extractors: Extractor[];
}

export interface ScrapeProfileRequest {
  profileId: string;
  pageTypeId: string;
  parameters?: Record<string, string>;
}
