import { DataRepository } from "../repositories/scrapingRepository";
import { ScrapedData } from "../types/scraping.types";

async function processRawFromDatabase() {
  // const dataRepo = new DataRepository();
  // const allRecords: ScrapedData[] = await dataRepo.findManyRaw(
  //   {} as ScrapedData
  // );
  function mapFieldsFromRaw(newRaw2: any[]) {
    const getFieldByName = (item: any[], fieldName: string) => {
      const fieldEntry = item.find((entry) =>
        entry?.[0]?.toLowerCase().includes(fieldName.toLowerCase())
      );
      return fieldEntry?.[1] || null;
    };

    const getFieldWithValidation = (item: any[], expectedFields: string[]) => {
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
      const matches = [...str.matchAll(/https?:\/\/[^\s)\]]+/g)];
      if (matches.length === 0) return null;
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
          const linkMatch = firstEntry[0].match(/\((https?:\/\/[^\s]*)$/);
          if (linkMatch) return linkMatch[1].trim();
        }
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

      nota_final: newRaw2.map((v) => {
        const notaValue = getFieldWithValidation(v, ["nota final"]);
        return extractNotaFinal(notaValue);
      }),
    };
  }

  const dataRepo = new DataRepository();
  const allRecords: ScrapedData[] = await dataRepo.findManyRaw(
    {} as ScrapedData
  );

  for (const record of allRecords) {
    let raw = record.raw;

    let lines = raw
      .replace(/Resumo da Proposta:\s*\n+/g, "Resumo da Proposta:")
      .replace(/Resumo:\s*\n+/g, "Resumo:")
      .trim()
      .split("\n")
      .filter((linha) => linha.trim() !== "");

    const mappedLines = lines.map((v1, lineIndex) => {
      const cleanLine = v1
        .trim()
        .replaceAll("<b>", "")
        .replaceAll("<br>", "")
        .replaceAll("</b>", "");

      if (lineIndex === 0 && cleanLine.match(/^\d+\.\s*/)) {
        return [cleanLine, ""];
      }
      return cleanLine;
    });

    const fields = mapFieldsFromRaw([mappedLines]);

    if (fields.titulo?.[0]) {
      const regexTituloLinha = /^.*\d+\.\s*.*$/gim;
      raw = raw.replace(regexTituloLinha, "");
    }
    if (fields.autor?.[0]) {
      const regexAutorLinha = /^.*(autor|author|aluno|aluna)\s*:\s*.*$/gim;
      raw = raw.replace(regexAutorLinha, "");
    }
    if (fields.curso?.[0]) {
      const regexCursoLinha = /^.*(curso|course)\s*:\s*.*$/gim;
      raw = raw.replace(regexCursoLinha, "");
    }
    if (fields.orientador?.[0]) {
      const possibleStrings = [
        "orientador",
        "orientador(a)",
        "orientadora",
        "Orientador",
        "Orientador(a)",
        "Orientadora",
        "orientadores",
        "Orientadores",
      ];
      const regexOrientadorLinha = `/^.*${possibleStrings.join("|")}(?:\(a\))?\s*:\s*.*$/gim`;
      raw = raw.trim().replace(regexOrientadorLinha, "");
    }
    if (fields.coorientador?.[0]) {
      const regexCoorientadorLinha =
        /^.*co[- ]?orientador(?:\(a\))?\s*:\s*.*$/gim;
      raw = raw.replace(regexCoorientadorLinha, "");
    }
    if (fields.possiveisAvaliadores?.[0]) {
      const possibleStrings = [
        "avaliadores",
        "possíveis avaliadores",
        "avaliador",
        "avaliadora",
      ];
      const regexAvaliadoresLinha = new RegExp(
        `^.*(${possibleStrings.join("|")})\\s*:\\s*.*$`,
        "gim"
      );
      raw = raw.replace(regexAvaliadoresLinha, "");
    }
    if (fields.resumoDaProposta?.[0]) {
      const regexResumoLinha = /^.*resumo(?: da proposta)?\s*:\s*.*$/gim;
      raw = raw.replace(regexResumoLinha, "");
    }
    if (fields.palavrasChave?.[0]) {
      const regexPalavrasChaveLinha = /^.*palavras[- ]?chave\s*:\s*.*$/gim;
      raw = raw.replace(regexPalavrasChaveLinha, "");
    }
    if (fields.apresentacao?.[0]) {
      const regexApresentacaoLinha = /^.*apresenta[cç][aã]o\s*:\s*.*$/gim;
      raw = raw.replace(regexApresentacaoLinha, "");
    }
    if (fields.banca?.[0]) {
      const regexBancaLinha = /^.*banca\s*:\s*.*$/gim;
      raw = raw.replace(regexBancaLinha, "");
    }
    if (fields.date?.[0]) {
      const regexDateLinha = /^.*data\s*:\s*.*$/gim;
      raw = raw.replace(regexDateLinha, "");
    }
    if (fields.horaLocal?.[0]) {
      const regexHoraLocalLinha = /^.*hora\/local\s*:\s*.*$/gim;
      raw = raw.replace(regexHoraLocalLinha, "");
    }
    if (fields.area?.[0]) {
      const regexAreaLinha = /^.*[áa]rea\s*:\s*.*$/gim;
      raw = raw.replace(regexAreaLinha, "");
    }
    if (fields.nota_final?.[0]) {
      const regexNotaFinalLinha = /^.*nota final\s*:\s*.*$/gim;
      raw = raw.replace(regexNotaFinalLinha, "");
    }

    // Atualiza o registro no banco
    await dataRepo.update(record.id, {
      title: fields.titulo?.[0] || null,
      tg: fields.tg?.[0] || null,
      initial_proposal: fields.propostaInicial?.[0] || null,
      author: fields.autor?.[0] || null,
      course: fields.curso?.[0] || null,
      advisor: fields.orientador?.[0] || null,
      co_Advisor: fields.coorientador?.[0] || null,
      possible_appraiser: fields.possiveisAvaliadores?.[0] || null,
      proposal_abstract: fields.resumoDaProposta?.[0] || null,
      key_words: fields.palavrasChave?.[0] || null,
      evaluation_panel: fields.banca?.[0] || null,
      semester: "1999-1",
      day: fields.date?.[0] || null,
      hour: fields.horaLocal?.[0] || null,
      local: fields.area?.[0] || null,
      area: fields.area?.[0] || null,
      final_score: fields.nota_final?.[0] || null,
      raw,
    });
  }
}

processRawFromDatabase();
