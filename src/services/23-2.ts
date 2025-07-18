import puppeteer from "puppeteer";
import { ScrapedData } from "../types/scraping.types";

const fs = require("fs").promises;

async function readFileExample(): Promise<string> {
  try {
    const data = await fs.readFile("src/utils/2023-2.md", "utf8");
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

    autor: newRaw2.map((v) =>
      getFieldWithValidation(v, ["autor", "author", "aluno", "aluna"])
    ),

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

    date: newRaw2.map((v) => getFieldWithValidation(v, ["data"])),

    horaLocal: newRaw2.map((v) => getFieldWithValidation(v, ["hora/local"])),
  };
}

(async () => {
  const data = (await readFileExample())
    .replaceAll("**", "")
    .replaceAll("[aqui](", "")
    .replaceAll(".pdf)", ".pdf")
    .replaceAll("\\", "")
    .split("\n");

  let newData: string[] = [];

  for (let i = 0; i < data.length; i++) {
    if (
      data[i].includes("Título:") ||
      data[i].includes("Aluno:") ||
      data[i].includes("Aluna:")
    ) {
      let raw = [data[i]];
      i++;

      while (
        i < data.length &&
        !data[i].includes("Banca:") &&
        !data[i].includes("Banca Examinadora:")
      ) {
        raw.push(data[i]);
        i++;
      }

      if (
        i < data.length &&
        (data[i].includes("Banca:") || data[i].includes("Banca Examinadora:"))
      ) {
        raw.push(data[i]);
      }
      newData.push(raw.join("\n"));
    }
  }

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

  const newRaw2 = newData.map((v) =>
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
    date,
    horaLocal,
  } = mapFieldsFromRaw(newRaw2);
  const semestre = "2023-2";

  const cursoProcessado = curso.map((v) =>
    v === null || v === undefined || v === "" ? "Engenharia da Computação" : v
  );

  const dia = apresentacao.map((v, index) => {
    const hasValidApresentacaoForThisItem =
      v !== null && v !== undefined && v.trim() !== "";

    if (hasValidApresentacaoForThisItem) {
      const diaValue = v?.slice(v.indexOf("dia: ") + 5, v.indexOf(","));
      if (diaValue?.trim() === "DD/MM/AAAA") {
        return null;
      }
      return diaValue;
    } else {
      const dateValue = date[index];
      if (!dateValue || dateValue.trim() === "") return null;
      return dateValue.trim();
    }
  });

  const hora = apresentacao.map((v, index) => {
    const hasValidApresentacaoForThisItem =
      v !== null && v !== undefined && v.trim() !== "";

    if (hasValidApresentacaoForThisItem) {
      const re = /hora: ([^,]+)/;
      const match = re.exec(v);
      const newMatch = match ? match[1]?.trim() : null;
      if (newMatch?.trim() === "XXhYY") {
        return null;
      }
      return newMatch || null;
    } else {
      const horaLocalValue = horaLocal[index];
      if (!horaLocalValue) return null;

      const patterns = [
        /(\d{1,2}:\d{2})/,
        /(\d{1,2}h\d{2})/,
        /(\d{1,2}h)/, //
      ];

      for (const pattern of patterns) {
        const match = horaLocalValue.match(pattern);
        if (match) {
          return match[1].trim();
        }
      }
      return null;
    }
  });

  const local = apresentacao.map((v, index) => {
    const hasValidApresentacaoForThisItem =
      v !== null && v !== undefined && v.trim() !== "";

    if (hasValidApresentacaoForThisItem) {
      const localValue = v?.slice(v.indexOf("local: ") + 7);
      if (localValue?.trim() === "LLLL") {
        return null;
      }
      return localValue;
    } else {
      const horaLocalValue = horaLocal[index];
      if (!horaLocalValue) return null;

      const separatorMatch = horaLocalValue.match(
        /(?:\d{1,2}(?::|h)\d{0,2}?)\s*[–\-,]\s*(.+)/
      );
      return separatorMatch ? separatorMatch[1].trim() : null;
    }
  });

  const scrapedDataArray: ScrapedData[] = newRaw2.map((rawText, index) => ({
    title: titulo[index],
    tg: tg[index],
    initial_proposal: propostaInicial[index],
    author: autor[index],
    course: cursoProcessado[index],
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
    date: date[index],
    hourLocal: horaLocal[index],
  }));

  // try {
  //   const data = new DataRepository();
  //   await data.saveMany(scrapedDataArray);
  // } catch (error) {
  //   console.error(error);
  // } finally {
  //   console.log("finished");
  // }

  await browser.close();
})();
