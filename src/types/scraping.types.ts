export interface ScrapedData {
  title: string;
  tg?: string;
  initial_proposal?: string;
  author: string;
  course: string;
  advisor?: string;
  co_Advisor?: string;
  possible_appraiser?: string;
  proposal_abstract?: string;
  day?: string;
  hour?: string;
  local?: string;
  evaluation_panel?: string;
  key_words?: string;
  semester: string;
}

export interface ScrapingOptions {
  headless?: boolean;
  timeout?: number;
  waitForSelector?: string;
}

export interface ScrapingResult {
  success: boolean;
  data?: ScrapedData[];
  error?: string;
  totalScraped: number;
}
