import { DataRepository } from "../repositories/scrapingRepository";
import { ScrapedData } from "../types/scraping.types";

// Função para processar e esvaziar o campo raw
async function processRawFromDatabase() {
  const dataRepo = new DataRepository();
  const allRecords: ScrapedData[] = await dataRepo.getAll({} as ScrapedData); // Busca todos os registros do banco

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

  for (const record of allRecords) {
    let raw = record.raw || "";

    // Divide o raw em linhas para reaproveitar sua lógica
    let lines = raw
      .replace(/Resumo da Proposta:\s*\n+/g, "Resumo da Proposta:")
      .replace(/Resumo:\s*\n+/g, "Resumo:")
      .trim()
      .split("\n")
      .filter((linha) => linha.trim() !== "");

    // Aplica o mesmo map das linhas para estrutura de chave/valor
    const mappedLines = lines.map((v1, lineIndex) => {
      const cleanLine = v1
        .trim()
        .replaceAll("<b>", "")
        .replaceAll("<br>", "")
        .replaceAll("</b>", "");

      if (lineIndex === 0 && cleanLine.match(/^\d+\.\s*/)) {
        return [cleanLine, ""];
      }
      return cleanLine.split(/:(.+)/, 2).map((v1) => v1.trim());
    });

    // Extrai os campos usando sua função
    const fields = mapFieldsFromRaw([mappedLines]);

    // Agora, para cada campo extraído, remova o trecho correspondente do raw
    // Exemplo para título:
    if (fields.titulo?.[0]) {
      const regexTitulo = new RegExp(`^\\d+\\.\\s*${fields.titulo[0]}.*`, "m");
      raw = raw.replace(regexTitulo, "");
    }
    // Repita para outros campos, criando regexs específicos para cada um
    if (fields.autor?.[0]) {
      const regexAutor = new RegExp(`Autor:\\s*${fields.autor[0]}.*`, "i");
      raw = raw.replace(regexAutor, "");
    }
    // ...repita para curso, orientador, etc...

    // No final, se tudo foi lido, raw deve estar vazio ou só com espaços
    if (raw.trim() === "") raw = null;

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
      semester: "1998-2",
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
