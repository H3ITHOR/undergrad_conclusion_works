export interface ScrapedData {
  title: string;
  tg?: string;
  Initial_proposal: string;
  Author: string;
  Course: string;
  Advisor: string;
  Co_Advisor?: string;
  Possible_appraiser?: string;
  Proposal_abstract: string;
  date?: string;
  day?: string;
  hour?: string;
  local?: string;
  evaluation_panel: string;
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
