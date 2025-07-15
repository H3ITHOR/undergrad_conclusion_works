import puppeteer from "puppeteer";
import { ScrapedData } from "../types/scraping.types";

const fs = require("fs").promises;

async function readFileExample(): Promise<string> {
  try {
    const data = await fs.readFile("src/utils/2023-1.md", "utf8");
    return data;
  } catch (err) {
    console.error("Error reading file:", err);
  }
}

(async () => {
  const data = (await readFileExample()).replaceAll("**", "");
  console.log(data);

  const browser = await puppeteer.launch({});
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
    "body > div > div:nth-child(12) > table > tbody > tr:nth-child(2) > td:nth-child(1) > h3 > u > span > a"; // seletor css do ano
  await page.waitForSelector(link);
  await page.click(link);

  const elementsArray = await page.evaluate(() => {
    const ol = document.querySelector("body > div > ol");

    const listItems = Array.from(ol.querySelectorAll("li"));
    console.log(listItems.map((el) => el.innerText));
    return listItems.map((el) => el.textContent.replace(/\n/g, " ").trim());
  });

  const HTMLelementsArray = await page.evaluate(() => {
    const ol = document.querySelector("body > div > ol");

    const listItems = Array.from(ol.querySelectorAll("li"));
    return listItems.map((el) => el.innerHTML);
  });

  const newRaw2 = HTMLelementsArray.map((v) =>
    v
      // .replace(/\n/g, " ")
      .replace("Resumo da Proposta:\n", "Resumo da Proposta:")
      .trim()
      .split("\n")
      .map((v1) =>
        v1
          .trim()
          .replaceAll("<b>", "")
          .replaceAll("<br>", "")
          .replaceAll("</b>", "")
          .split(/: (.*)/, 2)
          .map((v1) => {
            if (v1.trim().startsWith("<a")) {
              const re = /href="([^"]*)"/;
              const match = re.exec(v1);
              return `https://cin.ufpe.br/~tg/2024-1/${(match?.[1] || "")
                .replaceAll('"', "")
                .replace("href=", "")}`;
            }
            return v1.trim();
          })
      )
  );

  // Creio que dá para criar uma função para mapear todos esses elementos.

  const titulo = newRaw2.map((v) => v[0][1]);
  const tg = newRaw2.map((v) => v[1][1]);
  const propostaInicial = newRaw2.map((v) => v[2][1]);
  const autor = newRaw2.map((v) => v[3][1]);
  const curso = newRaw2.map((v) => v[4][1]);
  const orientador = newRaw2.map((v) => v[5][1]);
  const coorientador = newRaw2.map((v) => v[6][1]);
  const possiveisAvaliadores = newRaw2.map((v) => v[7][1]);
  const resumoDaProposta = newRaw2.map((v) => v[8][1]);
  const palavrasChave = newRaw2.map((v) => v[9][1]);
  const apresentacao = newRaw2.map((v) => v[10][1]);
  const banca = newRaw2.map((v) => {
    if (v[10][1] === "") {
      return null;
    }
    return v[10][1];
  });
  const semestre = "2023-1";

  const dia = apresentacao.map((v) => {
    v = v?.slice(v.indexOf("dia: ") + 5, v.indexOf(","));
    if (v?.trim() === "DD/MM/AAAA") {
      return null;
    }
    return v;
  });

  const hora = apresentacao.map((v?) => {
    const re = /hora: ([^,]+)/;
    const match = re.exec(v);
    const newMatch = match ? match[1]?.trim() : null;
    if (newMatch?.trim() === "XXhYY") {
      return null;
    }
    return newMatch || null;
  });

  const local = apresentacao.map((v) => {
    v = v?.slice(v.indexOf("local: ") + 7);
    if (v?.trim() === "LLLL") {
      return null;
    }
    return v;
  });

  const scrapedDataArray: ScrapedData[] = elementsArray.map(
    (rawText, index) => ({
      title: titulo[index],
      tg: tg[index],
      initial_proposal: propostaInicial[index],
      author: autor[index],
      course: curso[index],
      advisor: orientador[index],
      co_Advisor: coorientador[index],
      possible_appraiser: possiveisAvaliadores[index],
      proposal_abstract: resumoDaProposta[index],
      evaluation_panel: banca[index],
      semester: semestre,
      day: dia[index],
      hour: hora[index],
      local: local[index],
      key_words: palavrasChave[index],
    })
  );

  // try {
  //   const data = new DataRepository();
  //   await data.saveMany(scrapedDataArray);
  // } catch (error) {
  //   console.log(error);
  // } finally {
  //   console.log("finished");
  // }

  await browser.close();
})();
