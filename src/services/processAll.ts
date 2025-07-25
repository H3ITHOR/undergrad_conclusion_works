import { DataRepository } from "../repositories/scrapingRepository";
import { ScrapedData } from "../types/scraping.types";

const fs = require("fs").promises;

const arraySemesters: string[] = [
  "1998-2",
  "1999-1",
  "1999-2",
  "2000-1",
  "2000-2",
  "2001-1",
  "2001-2",
  "2002-1",
  "2002-2",
  "2003-1",
  "2003-2",
  "2004-1",
  "2004-2",
  "2005-1",
  "2005-2",
  "2006-1",
  "2006-2",
  "2007-1",
  "2007-2",
  "2008-1",
  "2008-2",
  "2009-1",
  "2009-2",
  "2010-1",
  "2010-2",
  "2011-1",
  "2011-2",
  "2012-1",
  "2012-2",
  "2013-1",
  "2013-2",
  "2014-1",
  "2014-2",
  "2015-1",
  "2015-2",
  "2016-1",
  "2016-2",
  "2017-1",
  "2017-2",
  "2018-1",
  "2018-2",
  "2019-1",
  "2019-2",
  "2020-1",
  "2020-2",
  "2021-1",
  "2021-2",
  "2022-1",
  "2022-2",
  "2023-1",
  "2023-2",
  "2024-1",
];

async function readFileExample(semester): Promise<string> {
  try {
    const data = await fs.readFile(`src/utils/${semester}.md`, "utf8");
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

  const extractBracketText = (str: string | null) => {
    if (!str) return null;
    const match = str.match(/\[([^\]]+)\]/);
    return match ? match[1].trim() : str.trim();
  };

  const extractAllLinks = (str: string | null) => {
    if (!str) return null;
    // Extrai todos os links http(s)://... até espaço ou parêntese
    const matches = [...str.matchAll(/https?:\/\/[^\s)\]]+/g)];
    if (matches.length === 0) return null;
    // Retorna como string separada por espaço
    return matches.map((m) => m[0]).join(" ");
  };

  const extractNotaFinal = (str: string | null) => {
    if (!str) return null;
    const match = str.match(/\s*([\d.,]+)/i);
    return match ? match[1].replace(",", ".").trim() : null;
  };

  return {
    titulo: newRaw2.map((v) => {
      const firstEntry = v.find(
        (entry) => entry?.[0] && entry[0].match(/^\d+\.\s*/)
      );
      if (firstEntry) {
        let line = firstEntry[0];
        line = extractBracketText(line);
        return line
          .replace(/^\d+\.\s*/, "")
          .replace("*", "")
          .trim();
      }
      let traditionalTitle = getFieldWithValidation(v, ["título", "title"]);
      return traditionalTitle || null;
    }),

    tg: newRaw2.map((v) => {
      const firstEntry = v.find(
        (entry) => entry?.[0] && entry[0].match(/^\d+\.\s*/)
      );
      if (firstEntry) {
        // Pega tudo após o último '(' até o fim da linha
        const linkMatch = firstEntry[0].match(/\((https?:\/\/[^\s]*)$/);
        if (linkMatch) return linkMatch[1].trim();
      }
      // Fallback para campo tradicional
      return getFieldWithValidation(v, ["tg"]);
    }),

    propostaInicial: newRaw2.map((v) => {
      const propostaValue = getFieldWithValidation(v, ["proposta inicial"]);
      return extractAllLinks(propostaValue);
    }),

    autor: newRaw2.map((v) => {
      const autorValue = getFieldWithValidation(v, [
        "autor",
        "author",
        "aluno",
        "aluna",
      ]);
      return extractBracketText(autorValue);
    }),

    curso: newRaw2.map((v) => getFieldWithValidation(v, ["curso", "course"])),

    orientador: newRaw2.map((v) => {
      const orientadorValue = getFieldWithValidation(v, [
        "orientador",
        "orientador(a)",
      ]);
      return extractBracketText(orientadorValue);
    }),

    coorientador: newRaw2.map((v) => {
      let coorientadorValue = getFieldWithValidation(v, [
        "coorientador",
        "co-orientador",
      ]);
      coorientadorValue = extractBracketText(coorientadorValue);
      return coorientadorValue;
    }),

    possiveisAvaliadores: newRaw2.map((v) => {
      const avaliadoresValue = getFieldWithValidation(v, [
        "possíveis avaliadores",
        "avaliadores",
        "avaliador",
        "avaliadora",
      ]);
      return extractBracketText(avaliadoresValue);
    }),

    resumoDaProposta: newRaw2.map((v) => {
      const resumo = getFieldWithValidation(v, [
        "resumo da proposta",
        "resumo",
      ]);
      return resumo ? resumo.replaceAll("\n", " ") : null;
    }),

    palavrasChave: newRaw2.map((v) =>
      getFieldWithValidation(v, [
        "palavras-chave",
        "palavras chave",
        "key words",
      ])
    ),

    apresentacao: newRaw2.map((v) =>
      getFieldWithValidation(v, ["apresentação", "apresentacao", "defesa"])
    ),

    banca: newRaw2.map((v) => getFieldWithValidation(v, ["banca"])),

    date: newRaw2.map((v) => getFieldWithValidation(v, ["data"])),

    horaLocal: newRaw2.map((v) => getFieldWithValidation(v, ["hora/local"])),

    area: newRaw2.map((v) => getFieldWithValidation(v, ["area", "área"])),

    nota_final: newRaw2.map((v) => {
      const notaValue = getFieldWithValidation(v, ["nota final"]);
      return extractNotaFinal(notaValue);
    }),
  };
}

async function execute(semester: string) {
  console.log("actual semester: " + semester);
  const data = (await readFileExample(semester))
    .replaceAll("*", "")
    .replaceAll("[aqui](", "")
    .replaceAll("[aq]", ", ")
    .replaceAll("[a]", "")
    .replaceAll("[aqu]", "")
    .replaceAll("[ui]", "")
    .replaceAll("[i]", "")
    .replaceAll(".pdf)", ".pdf")
    .replaceAll("\\", "")
    .split("\n");

  let newData: string[] = [];

  const possibleFields = [
    "título",
    "title",
    "tg",
    "proposta inicial",
    "autor",
    "author",
    "aluno",
    "aluna",
    "autora",
    "autoras",
    "alunos",
    "alunas",
    "curso",
    "course",
    "orientador",
    "orientador(a)",
    "orientadora",
    "orientadores",
    "coorientador",
    "co-orientador",
    "coorientador(a)",
    "coorientadora",
    "coorientadores",
    "possíveis avaliadores",
    "avaliadores",
    "avaliador",
    "avaliadora",
    "resumo da proposta",
    "resumo",
    "palavras-chave",
    "palavras chave",
    "key words",
    "apresentação",
    "apresentacao",
    "defesa",
    "banca",
    "data",
    "hora/local",
    "área",
    "area",
    "nota final",
  ];

  for (let i = 0; i < data.length; i++) {
    if (data[i].match(/^\s*\d+\.\s*/)) {
      let raw = [data[i]];
      i++;

      while (
        i < data.length &&
        !data[i].match(/^\s*\d+\.\s*/) &&
        !data[i].includes("---") &&
        !data[i].match(/^\*\*[A-Z]/)
      ) {
        raw.push(data[i]);
        i++;
      }

      // Volta um índice porque o while já avançou para o próximo trabalho
      if (i < data.length && data[i].match(/^\s*\d+\.\s*/)) {
        i--;
      }

      newData.push(raw.join("\n"));
    }
  }

  const rawDataObject: ScrapedData[] = newData.map((v) => ({
    raw: v,
    semester,
  }));

  try {
    const data = new DataRepository();
    await data.saveMany(rawDataObject);
  } catch (error) {
    console.error(error);
  } finally {
    console.log("finished semester " + semester);
  }

  console.log("fim");
}

async function main() {
  for (const semester of arraySemesters) {
    await execute(semester);
  }
}

main();
