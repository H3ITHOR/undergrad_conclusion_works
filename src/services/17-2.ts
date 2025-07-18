import { DataRepository } from "../repositories/scrapingRepository";
import { ScrapedData } from "../types/scraping.types";

const fs = require("fs").promises;

async function readFileExample(): Promise<string> {
  try {
    const data = await fs.readFile("src/utils/2017-2.md", "utf8");
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
    titulo: newRaw2.map((v) => {
      // Procura pela primeira entrada que é o título
      const firstEntry = v.find(
        (entry) => entry?.[0] && entry[0].match(/^\d+\.\s*/)
      );

      if (firstEntry) {
        const line = firstEntry[0];

        // Remove "1. " e asteriscos, mantém tudo incluindo ":"
        return line
          .replace(/^\d+\.\s*/, "") // Remove "1. "
          .replace(/\*\*/g, "") // Remove "**"
          .trim();
      }

      // Fallback para padrão tradicional
      const traditionalTitle = getFieldWithValidation(v, ["título", "title"]);
      return traditionalTitle || null;
    }),

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
    .replaceAll("**", "")
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
  const semestre = "2017-2";

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
      const re = /hora ([^,]+)/;
      const match = re.exec(v);
      const newMatch = match ? match[1]?.trim() : null;
      if (newMatch?.trim() === "XXhYY") {
        return null;
      }
      return newMatch || null;
    } else {
      const horaLocalValue = horaLocal[index];
      if (!horaLocalValue) return null;

      const patterns = [/(\d{1,2}:\d{2})/, /(\d{1,2}h\d{2})/, /(\d{1,2}h)/];

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
