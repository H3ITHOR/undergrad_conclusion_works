import { DataRepository } from "../repositories/scrapingRepository";
import { ScrapedData } from "../types/scraping.types";

async function processRawFromDatabase() {
  function mapFieldsFromRaw(newRaw2: any[], possibleFields: string[]) {
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

      str = str.replace(/\*+/g, "").trim();

      const bracketMatch = str.match(/\[([^\]]+)\]/);
      if (bracketMatch) {
        return bracketMatch[1].trim();
      }

      return str.trim();
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
        // 1. Busca pelo formato "n. Título" na mesma linha
        const firstEntry = v.find(
          (entry) =>
            entry?.[0] &&
            entry[0].match(/^\d+\.\s*.*$/) &&
            !entry[0].match(/^\d+\.\s*$/) // Não é só o número
        );
        if (firstEntry) {
          let line = firstEntry[0];
          line = extractBracketText(line);
          line = line.replace(/^\d+\.\s*/, ""); // Remove "n."
          line = line
            .replace(/t[ií]tulo\s*:\s*/i, "")
            .replace(/title\s*:\s*/i, "");
          return line.replace("*", "").trim();
        }

        // 2. Caso: "n." em uma linha e "Título: ..." na próxima
        for (let i = 0; i < v.length - 1; i++) {
          const current = v[i]?.[0]?.trim();
          const next = v[i + 1]?.[0]?.trim();

          if (
            current &&
            current.match(/^\d+\.\s*$/) && // Só número e ponto
            next &&
            (next.toLowerCase().includes("título:") ||
              next.toLowerCase().includes("title:"))
          ) {
            let line = next;
            line = extractBracketText(line);
            line = line
              .replace(/t[ií]tulo\s*:\s*/i, "")
              .replace(/title\s*:\s*/i, "");
            return line.replace("*", "").trim();
          }
        }

        // 3. Caso: "n." em uma linha e título direto na próxima (sem "Título:")
        for (let i = 0; i < v.length - 1; i++) {
          const current = v[i]?.[0]?.trim();
          const next = v[i + 1]?.[0]?.trim();

          if (
            current &&
            current.match(/^\d+\.\s*$/) && // Só número e ponto
            next &&
            !next.toLowerCase().includes("autor") &&
            !next.toLowerCase().includes("curso") &&
            !next.toLowerCase().includes("orientador") &&
            !next.toLowerCase().includes("resumo") &&
            !next.toLowerCase().includes("proposta") &&
            next.length > 10 // Título tem pelo menos 10 caracteres
          ) {
            let line = next;
            line = extractBracketText(line);
            return line.replace("*", "").trim();
          }
        }

        // 4. Busca por campo explícito "Título:" ou "Title:"
        const explicitTitleEntry = v.find(
          (entry) =>
            entry?.[0] &&
            (entry[0].toLowerCase().includes("título") ||
              entry[0].toLowerCase().includes("title"))
        );
        if (explicitTitleEntry) {
          return explicitTitleEntry[1]?.trim() || explicitTitleEntry[0]?.trim();
        }

        // 5. Fallback usando campo "tg"
        let tgTitle = getFieldWithValidation(v, [
          "tg",
          "trabalho de graduação",
          "trabalho de graduaçao",
          "trabalho de graduacao",
        ]);
        if (tgTitle) {
          return tgTitle.trim();
        }

        return null;
      }),

      tg: newRaw2.map((v) => {
        const tgValue = getFieldWithValidation(v, [
          "tg",
          "trabalho de graduaçao",
          "trabalho de graduação",
          "trabalho de graduacao",
        ]);
        const firstEntry = v.find(
          (entry) => entry?.[0] && entry[0].match(/^\d+\.\s*/)
        );
        if (firstEntry) {
          const linkMatch = firstEntry[0].match(/\((https?:\/\/[^\s]*)$/);
          if (linkMatch) return linkMatch[1].trim();
        }
        return tgValue || getFieldWithValidation(v, ["tg"]);
      }),

      propostaInicial: newRaw2.map((v) => {
        const propostaValue = getFieldWithValidation(v, ["proposta inicial"]);
        if (!propostaValue) return null;

        // Se o texto começa com "proposta", extrai apenas os links
        if (propostaValue.toLowerCase().startsWith("proposta")) {
          return extractAllLinks(propostaValue);
        }

        return extractAllLinks(propostaValue);
      }),

      course: newRaw2.map((v) => {
        const courseValue = getFieldWithValidation(v, [
          "curso",
          "course",
          "cursos",
        ]);
        return courseValue;
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
          "orientadora",
          "Orientador",
          "Orientador(a)",
          "Orientadora",
          "orientadores",
          "Orientadores",
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
      apresentacao: newRaw2.map((v) =>
        getFieldWithValidation(v, ["apresentação", "apresentacao", "defesa"])
      ),

      resumoDaProposta: newRaw2.map((v) => {
        const resumoIndex = v.findIndex(
          (entry) =>
            entry?.[0] &&
            ["resumo da proposta", "resumo"].some((field) =>
              entry[0].toLowerCase().includes(field)
            )
        );
        if (resumoIndex === -1) return null;

        let resumoLines = [];
        for (let i = resumoIndex; i < v.length; i++) {
          const entry = v[i];
          const fieldName = entry?.[0]?.toLowerCase().replace(/\*/g, "").trim();
          const isNewField = possibleFields.some(
            (field) => fieldName && fieldName === field.toLowerCase()
          );
          if (i !== resumoIndex && isNewField) break;
          resumoLines.push(entry?.[1] || entry?.[0] || "");
        }
        return resumoLines.join(" ").replace(/\n+/g, " ").trim();
      }),

      palavrasChave: newRaw2.map((v) =>
        getFieldWithValidation(v, [
          "palavras-chave",
          "palavras chave",
          "key words",
        ])
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
    "nota",
  ];

  for (const record of allRecords) {
    let raw = record.raw;
    let semester = record.semester;

    // Pré-processa o resumo para separar apresentação
    let apresentacaoText = null;
    let resumoText = raw.trim();

    // Regex para encontrar apresentação dentro do resumo
    const apresentacaoRegex = /(apresenta[cç][aã]o\s*:\s*.+)$/im;
    const apresentacaoMatch = raw.match(apresentacaoRegex);

    if (apresentacaoMatch) {
      apresentacaoText = apresentacaoMatch[1].trim();
      // Remove apresentação do resumo
    }

    // Agora, use resumoText para split das linhas
    let lines = resumoText
      .replace(/Resumo da Proposta:\s*\n+/g, "Resumo da Proposta:")
      .replace(/Resumo:\s*\n+/g, "Resumo:")
      .trim()
      .split("\n")
      .filter((linha) => linha.trim() !== "");

    // Mapeia as linhas normalmente
    const mappedLines = lines.map((v1, lineIndex) => {
      const cleanLine = v1
        .trim()
        .replaceAll("<b>", "")
        .replaceAll("<br>", "")
        .replaceAll("</b>", "")
        .replace(/^\*+/, "") // Remove asteriscos do início
        .trim();

      if (lineIndex === 0 && cleanLine.match(/^\d+\.\s*/)) {
        return [cleanLine, ""];
      }

      const split = cleanLine.split(/:(.+)/);
      if (split.length > 1) {
        const fieldName = split[0].replace(/^\*+/, "").trim().toLowerCase();
        const value = split[1].trim();
        return [fieldName, value];
      }

      return [cleanLine.toLowerCase(), ""];
    });

    // Adiciona apresentação como campo mapeado
    if (apresentacaoText) {
      mappedLines.push(["apresentação", apresentacaoText]);
    }

    const notaFinalRegex = /nota final\s*:\s*([\d.,]+)/i;
    const notaFinalMatch = raw.match(notaFinalRegex);

    let notaFinalValue = null;
    if (notaFinalMatch) {
      notaFinalValue = notaFinalMatch[1].replace(",", ".").trim();
    }

    const fields = mapFieldsFromRaw([mappedLines], possibleFields);

    if (fields.titulo?.[0]) {
      const regexTituloLinha = /^.*\d+\.\s*.*$/gim;
      raw = raw.replace(regexTituloLinha, "");
    }

    if (fields.tg?.[0]) {
      const regexTGLinha =
        /^.*(tg|trabalho de graduação|trabalho de graduaçao|trabalho de graduacao|tg final)\s*.*$/gim;
      raw = raw.replace(regexTGLinha, "");
    }
    if (fields.autor?.[0]) {
      const regexAutorLinha =
        /^.*(autor|author|aluno|aluna|autora|autoras|alunos|alunas|autor\(a\)|Autor\(a\))\s*:.*$/gim;
      raw = raw.replace(regexAutorLinha, "");
    }
    if (fields.curso?.[0]) {
      const regexCursoLinha = /^.*(curso|course)\s*:.*$/gim;
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
      const regexOrientadorLinha = new RegExp(
        `^.*(${possibleStrings.join("|")})(?:\\(a\\))?\\s*:\\s*.*$`,
        "gim"
      );
      raw = raw.replace(regexOrientadorLinha, "");
    }
    if (fields.coorientador?.[0]) {
      const regexCoorientadorLinha = /^.*co[- ]?orientador(?:\(a\))?\s*:.*$/gim;
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
        `^.*(${possibleStrings.join("|")})\\s*\\s*.*$`,
        "gim"
      );
      raw = raw.replace(regexAvaliadoresLinha, "");
    }
    if (fields.resumoDaProposta?.[0]) {
      const regexResumoLinha = /^.*resumo(?: da proposta)?\s*:\s*.*$/gim;
      raw = raw.replace(regexResumoLinha, "");
    }
    if (fields.propostaInicial?.[0]) {
      const regexPropostaInicialLinha = /^.*proposta inicial\s*:\s*.*$/gim;
      raw = raw.replace(regexPropostaInicialLinha, "");
    }
    if (fields.palavrasChave?.[0]) {
      const regexPalavrasChaveLinha = /^.*palavras[- ]?chave\s*:\s*.*$/gim;
      raw = raw.replace(regexPalavrasChaveLinha, "");
    }
    if (fields.apresentacao?.[0]) {
      const regexApresentacaoLinha =
        /^.*(apresenta[cç][aã]o|defesa|apresentacao|apresenta[çc][aã]o|presentation)\s*:\s*.*$/gim;
      raw = raw.replace(regexApresentacaoLinha, "");
    }
    if (fields.banca?.[0]) {
      const regexBancaLinha =
        /^.*(banca | banca examinadora | bancas | bancas examinadoras)\s*:.*$/gim;
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

    raw = raw.trim() === "" ? null : raw.trim();

    const apresentacaoValue =
      fields.apresentacao?.[0] || fields.horaLocal?.[0] || "";
    let day = null,
      hour = null,
      local = null;

    if (apresentacaoValue) {
      // Normaliza para facilitar o parsing
      const value = apresentacaoValue
        .replace(/\s+/g, " ")
        .replace(/[\*]+/g, "")
        .trim();

      // Dia: busca por dd/mm/yyyy ou dd/mm/yy
      const dayMatch = value.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      day = dayMatch ? dayMatch[1] : null;

      // Hora: busca por hh:mm, hh:mmhs, hhhs, etc
      const hourMatch =
        value.match(/(\d{1,2}:\d{2}(?:h)?(?:s)?)/) ||
        value.match(/(\d{1,2}h(?:s)?)/);
      hour = hourMatch ? hourMatch[1] : null;

      // Local: normalmente após a última vírgula ou após "local:"
      const localMatch = value.match(/local[:\s]*([^\n,]+)/i);
      if (localMatch) {
        local = localMatch[1].trim();
      } else {
        // Se não tiver "local:", pega o último trecho após vírgula
        const parts = value.split(",");
        if (parts.length > 1) {
          local = parts[parts.length - 1].trim();
          // Remove possíveis textos irrelevantes
          if (
            local.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/) ||
            local.match(/\d{1,2}:\d{2}/) ||
            local.match(/\d{1,2}h/)
          ) {
            local = null;
          }
        }
      }
    }

    // Atualiza o registro no banco
    await dataRepo.update(record.id, {
      title: record.title ? record.title : fields.titulo?.[0] || null,
      tg: record.tg ? record.tg : fields.tg?.[0] || null,
      initial_proposal: record.initial_proposal
        ? record.initial_proposal
        : fields.propostaInicial?.[0] || null,
      author: record.author || fields.autor?.[0] || null,
      course: record.course || fields.curso?.[0] || null,
      advisor: record.advisor ? record.advisor : fields.orientador?.[0] || null,
      co_Advisor: record.co_Advisor || fields.coorientador?.[0] || null,
      possible_appraiser:
        record.possible_appraiser || fields.possiveisAvaliadores?.[0] || null,
      proposal_abstract:
        record.proposal_abstract || fields.resumoDaProposta?.[0] || null,
      key_words: record.key_words || fields.palavrasChave?.[0] || null,
      evaluation_panel: record.evaluation_panel || fields.banca?.[0] || null,
      semester,
      area: record.area ? record.area : fields.area?.[0] || null,
      day: record.day || day,
      hour: record.hour || hour,
      local: record.local || local,
      final_score: record.final_score || fields.nota_final?.[0] || null,
      raw,
    });
  }
}

processRawFromDatabase();
