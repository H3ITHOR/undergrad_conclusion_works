import puppeteer from "puppeteer";
import { DataRepository } from "../repositories/scrapingRepository";
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

function mapFieldsFromRaw(newRaw2: any[]) {
  const getFieldByName = (item: any[], fieldName: string) => {
    // Procura pelo campo baseado no nome, não na posição
    const fieldEntry = item.find((entry) =>
      entry?.[0]?.toLowerCase().includes(fieldName.toLowerCase())
    );
    return fieldEntry?.[1] || null;
  };

  const getFieldWithValidation = (item: any[], expectedFields: string[]) => {
    // Tenta encontrar o campo usando qualquer uma das variações possíveis
    for (const fieldName of expectedFields) {
      const result = getFieldByName(item, fieldName);
      if (result) return result;
    }
    return null;
  };

  return {
    titulo: newRaw2.map((v) => getFieldWithValidation(v, ["título", "title"])),

    tg: newRaw2.map((v) => getFieldWithValidation(v, ["tg"])),

    propostaInicial: newRaw2.map((v) =>
      getFieldWithValidation(v, ["proposta inicial"])
    ),

    autor: newRaw2.map((v) => getFieldWithValidation(v, ["autor", "author"])),

    curso: newRaw2.map((v) => getFieldWithValidation(v, ["curso", "course"])),

    orientador: newRaw2.map((v) =>
      getFieldWithValidation(v, ["orientador", "orientador(a)"])
    ),

    coorientador: newRaw2.map((v) =>
      getFieldWithValidation(v, ["coorientador", "co-orientador"])
    ),

    possiveisAvaliadores: newRaw2.map((v) =>
      getFieldWithValidation(v, ["possíveis avaliadores", "avaliadores"])
    ),

    resumoDaProposta: newRaw2.map((v) =>
      getFieldWithValidation(v, ["resumo da proposta", "resumo"])
    ),

    palavrasChave: newRaw2.map((v) =>
      getFieldWithValidation(v, [
        "palavras-chave",
        "palavras chave",
        "key words",
      ])
    ),

    apresentacao: newRaw2.map((v) =>
      getFieldWithValidation(v, ["apresentação", "apresentacao"])
    ),

    banca: newRaw2.map((v) => getFieldWithValidation(v, ["banca"])),
  };
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
    "body > div > div:nth-child(12) > table > tbody > tr:nth-child(2) > td:nth-child(1) > h3 > u > span > a";
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
          .split(/:(.+)/, 2)
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

  const {
    titulo,
    tg,
    propostaInicial,
    autor,
    curso,
    orientador,
    coorientador,
    possiveisAvaliadores,
    resumoDaProposta,
    palavrasChave,
    apresentacao,
    banca,
  } = mapFieldsFromRaw(newRaw2);
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

  try {
    const data = new DataRepository();
    await data.saveMany(scrapedDataArray);
  } catch (error) {
    console.log(error);
  } finally {
    console.log("finished");
  }

  await browser.close();
})();
