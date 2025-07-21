import { DataRepository } from "../repositories/scrapingRepository";
import { ScrapedData } from "../types/scraping.types";

const fs = require("fs").promises;

async function readFileExample(): Promise<string> {
  try {
    const data = await fs.readFile("src/utils/2015-1.md", "utf8");
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

    propostaInicial: newRaw2.map((v) =>
      getFieldWithValidation(v, ["proposta inicial"])
    ),

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
      ]);
      return extractBracketText(avaliadoresValue);
    }),

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
      getFieldWithValidation(v, ["apresentação", "apresentacao", "defesa"])
    ),

    banca: newRaw2.map((v) => getFieldWithValidation(v, ["banca"])),

    date: newRaw2.map((v) => getFieldWithValidation(v, ["data"])),

    horaLocal: newRaw2.map((v) => getFieldWithValidation(v, ["hora/local"])),

    area: newRaw2.map((v) => getFieldWithValidation(v, ["area", "área"])),
  };
}

(async () => {
  const data = (await readFileExample())
    .replaceAll("*", "")
    .replaceAll("[aqui](", "")
    .replaceAll(".pdf)", ".pdf")
    .replaceAll("\\", "")
    .split("\n");

  let newData: string[] = [];

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

  const newRaw2 = newData.map((v) =>
    v
      .replace(/Resumo da Proposta:\s*\n+/g, "Resumo da Proposta:")
      .replace(/Resumo:\s*\n+/g, "Resumo:")
      .trim()
      .split("\n")
      .map((v1, lineIndex) => {
        const cleanLine = v1
          .trim()
          .replaceAll("<b>", "")
          .replaceAll("<br>", "")
          .replaceAll("</b>", "");

        // Se é a primeira linha E começa com número, NÃO divide por ':'
        if (lineIndex === 0 && cleanLine.match(/^\d+\.\s*/)) {
          return [cleanLine, ""]; // Retorna a linha completa como chave, valor vazio
        }

        // Para todas as outras linhas, faz o split normal
        return cleanLine.split(/:(.+)/, 2).map((v1) => {
          if (v1.trim().startsWith("<a")) {
            const re = /href="([^"]*)"/;
            const match = re.exec(v1);
            return `https://cin.ufpe.br/~tg/2024-1/${(match?.[1] || "")
              .replaceAll('"', "")
              .replace("href=", "")}`;
          }
          return v1.trim();
        });
      })
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
    area,
  } = mapFieldsFromRaw(newRaw2);
  const semestre = "2015-1";

  const cursoProcessado = curso.map((v) =>
    v === null || v === undefined || v === "" ? null : v
  );

  const dia = apresentacao.map((v) => {
    if (!v) return null;

    // Captura apenas a data no formato dd/mm/yyyy, ignorando qualquer texto antes
    const diaMatch = v.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    return diaMatch ? diaMatch[1] : null;
  });

  const hora = apresentacao.map((v) => {
    if (!v) return null;

    const horaMatch = v.match(/(\d{1,2}:\d{2})hs/);
    if (horaMatch) {
      return horaMatch[1]; // Retorna "14:00"
    }

    // Fallback para formato tradicional
    const re = /hora[:\s]*([^,]+)/;
    const match = re.exec(v);
    const newMatch = match ? match[1]?.trim() : null;
    if (newMatch && newMatch.trim() !== "XXhYY") {
      return newMatch;
    }

    return null;
  });

  const local = apresentacao.map((v) => {
    if (!v) return null;

    const parts = v.split(",");
    if (parts.length >= 4) {
      const localPart = parts[parts.length - 1].trim();
      if (
        localPart &&
        localPart !== "LOCAL A CONFIRMAR" &&
        !localPart.includes("feira") &&
        !localPart.includes("/") &&
        !localPart.includes("hs")
      ) {
        return localPart;
      }
      return null;
    }

    if (parts.length === 3) {
      const lastPart = parts[2].trim();
      const localOnly = lastPart.replace(/\d{1,2}:\d{2}hs\s*/, "").trim();
      if (localOnly && localOnly !== "LOCAL A CONFIRMAR") {
        return localOnly;
      }
    }

    return null;
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
    area: area[index],
  }));

  try {
    const data = new DataRepository();
    await data.saveMany(scrapedDataArray);
  } catch (error) {
    console.error(error);
  } finally {
    console.log("finished");
  }

  console.log("fim");
})();
