export interface ScrapedData {
  raw: string;
  title: string;
  tg?: string;
  Initial_proposal: string;
  Author: string;
  Course: string;
  Advisor: string;
  Co_Advisor?: string;
  Possible_appraiser?: string;
  Proposal_abstract: string;
  date: string;
  evaluation_panel: string;
  local?: string;
  key_words?: string;
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
