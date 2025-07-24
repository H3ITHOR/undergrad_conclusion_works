import { DataRepository } from "../repositories/scrapingRepository";
import { ScrapedData } from "../types/scraping.types";

const fs = require("fs").promises;

async function readFileExample(): Promise<string> {
  try {
    const data = await fs.readFile("src/utils/2007-2.md", "utf8");
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

(async () => {
  const data = (await readFileExample())
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
    // Detecta linhas que começam com número seguido de ponto
    if (data[i].match(/^\s*\d+\.\s*/)) {
      let raw = [data[i]];
      i++;

      while (
        i < data.length &&
        !data[i].match(/^\s*\d+\.\s*/) && // Não é o próximo número
        !data[i].includes("---") && // Não é separador de seção
        !data[i].match(/^\*\*[A-Z]/) // Não é início de nova seção (ex: **Engenharia**)
      ) {
        // // Verifica se a linha contém algum dos possíveis campos
        // const isFieldLine = possibleFields.some((field) =>
        //   data[i]
        //     .toLowerCase()
        //     .normalize("NFD")
        //     .replace(/[\u0300-\u036f]/g, "")
        //     .includes(
        //       field
        //         .toLowerCase()
        //         .normalize("NFD")
        //         .replace(/[\u0300-\u036f]/g, "")
        //     )
        // );
        // if (!isFieldLine && raw.length > 1) {
        //   // Se não for campo e já leu pelo menos uma linha além do título, encerra o raw
        //   break;
        // }
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
    semester: "2007-2",
  }));

  try {
    const data = new DataRepository();
    await data.saveMany(rawDataObject);
  } catch (error) {
    console.error(error);
  } finally {
    console.log("finished");
  }

  console.log("fim");
})();
