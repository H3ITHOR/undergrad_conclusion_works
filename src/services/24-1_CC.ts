import puppeteer from "puppeteer";

(async () => {
  const browser = await puppeteer.launch({
    // headless: false,
    // devtools: true,
  });
  const page = await browser.newPage();

  await page.goto("https://cin.ufpe.br/~tg/");

  const resolution = await page.evaluate(() => {
    return {
      width: window.screen.width,
      height: window.screen.height,
    };
  });

  await page.setViewport({
    width: resolution.width,
    height: resolution.height,
  });

  const link =
    "body > div > div:nth-child(12) > table > tbody > tr:nth-child(1) > td:nth-child(1) > h3 > u > span > a";
  await page.waitForSelector(link);
  await page.click(link);

  const elementsArray = await page.evaluate(() => {
    const ol = document.querySelector("body > div > ol");

    const listItems = Array.from(ol.querySelectorAll("li"));
    console.log(listItems.map((el) => el.innerHTML));
    return listItems.map((el) => el.textContent);
  });

  const HTMLelementsArray = await page.evaluate(() => {
    const ol = document.querySelector("body > div > ol");

    const listItems = Array.from(ol.querySelectorAll("li"));
    return listItems.map((el) => el.innerHTML);
  });
  // just to take as reference
  //   export interface ScrapedData {
  //   raw: string;
  //   title: string;
  //   tg?: string;
  //   Initial_proposal: string;
  //   Author: string;
  //   Course: string;
  //   Advisor: string;
  //   Co_Advisor?: string;
  //   Possible_appraiser?: string;
  //   Proposal_abstract: string;
  //   date: string;
  //   evaluation_panel: string;
  //   local?: string;
  //   key_words?: string;
  // }
  const raw = elementsArray;
  const HTMLraw = HTMLelementsArray;
  const title = raw.map((el) =>
    el.slice(el.indexOf("Título:") + 7, el.indexOf("\n      TG: ")).trim()
  );
  const tg = HTMLraw.map((el) => {
    const hrefStart = el.indexOf('href="');
    const hrefEnd = el.indexOf('"', hrefStart + 6);

    if (hrefStart !== -1 && hrefEnd !== -1) {
      const relativePath = el.slice(hrefStart + 6, hrefEnd);
      return `https://www.cin.ufpe.br/~tg/2024-1/${relativePath}`;
    }

    return null;
  });

  // console.log(elementsArray);
  console.log(title);
  console.log(tg);

  await browser.close();
})();
