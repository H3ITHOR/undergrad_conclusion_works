import { DataRepository } from "../repositories/scrapingRepository";
import { ScrapedData } from "../types/scraping.types";

async function processRawFromDatabase() {
  const extractNotaFinal = (str: string | null) => {
    if (!str) return null;

    const cleanStr = str
      .replace(/\*+/g, "")
      .replace(/<[^>]*>/g, "")
      .trim();

    if (
      cleanStr.match(/^\?[,.]?\?$/) || // "?,?" ou "??"
      cleanStr.match(/^-[,.]?-$/) || // "-,-" ou "--"
      cleanStr.match(/^\?\s*$/) || // Só "?"
      cleanStr.match(/^-\s*$/) || // Só "-"
      cleanStr.toLowerCase().includes("faltou") // "FALTOU"
    ) {
      return null;
    }

    const patterns = [
      /nota final[:\s]*([\d.,]+)/i, // "Nota final: 8,5"
      /\*\*nota final[:\s]*([\d.,]+)\*\*/i, // "**Nota final: 8,5**"
      /nota final[:\s]*([\d.,]+)\s*\(/i, // "Nota final: 8,5 ([detalhamento"
      /^([\d.,]+)\s*\(/, // "8,5 ([detalhamento..." no início
      /:\s*([\d.,]+)$/, // ": 8,5" no final
      /^\s*([\d.,]+)\s*$/, // Só o número
      /final[:\s]*([\d.,]+)/i, // "final: 8,5"
      /([\d.,]+)\s*\([^)]*detalhamento[^)]*\)/i, // "8,5 ([detalhamento...])"
    ];

    for (const pattern of patterns) {
      const match = cleanStr.match(pattern);
      if (match && match[1]) {
        const nota = match[1].replace(",", ".").trim();

        if (nota.match(/^\?[,.]?\?$/) || nota.match(/^-[,.]?-$/)) {
          return null;
        }

        const numero = parseFloat(nota);
        if (!isNaN(numero) && numero >= 0 && numero <= 10) {
          return nota;
        }
      }
    }

    return null;
  };
  function mapFieldsFromRaw(newRaw2: any[], possibleFields: string[]) {
    const getFieldByName = (item: any[], fieldName: string) => {
      const fieldEntry = item.find((entry) => {
        if (!entry?.[0]) return false;

        const entryText = entry[0]
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[_*]/g, "")
          .replace(/:/g, "")
          .trim();

        const searchField = fieldName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/:/g, "")
          .trim();

        return entryText.startsWith(searchField);
      });

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
        // 1. Busca campo específico de TG primeiro
        const tgValue = getFieldWithValidation(v, [
          "tg",
          "trabalho de graduaçao",
          "trabalho de graduação",
          "trabalho de graduacao",
        ]);

        if (tgValue) {
          const links = extractAllLinks(tgValue);
          if (links) return links;
          return tgValue;
        }

        // 2. Busca na primeira linha numerada (formato "1. Título")
        const firstEntry = v.find(
          (entry) => entry?.[0] && entry[0].match(/^\d+\.\s*/)
        );

        if (firstEntry) {
          const fullLine = firstEntry[0];

          // Padrões para extrair TG da linha com título (expandidos para todos os formatos e case-insensitive)
          const tgPatterns = [
            // TG explícito
            /tg\s*:\s*(https?:\/\/[^\s)\]]+)/i,
            // Link que contém "/tg/" mas não "proposta"
            /\((https?:\/\/[^\s)]*\/tg\/[^\s)]*(?<!proposta\.(?:pdf|doc|docx|zip|rar|ps))[^\s)]*)\)$/i,
            // TG no final da linha entre parênteses (qualquer arquivo, não proposta) - case insensitive
            /\((https?:\/\/[^\s)]*(?:\/tg\/|\.(?:pdf|doc|docx|zip|rar|ps|part\d+\.rar))(?!.*proposta)[^\s)]*)\)$/i,
            // Link de arquivo que não é proposta no final - case insensitive
            /\((https?:\/\/[^\s)]*\.(?:pdf|doc|docx|zip|rar|ps|part\d+\.rar)(?!.*proposta)[^\s)]*)\)$/i,
            // Casos específicos como "part1.rar"
            /\((https?:\/\/[^\s)]*\.part\d+\.rar[^\s)]*)\)$/i,
            // Arquivos .ps.gz
            /\((https?:\/\/[^\s)]*\.ps\.gz(?!.*proposta)[^\s)]*)\)$/i,
          ];

          for (const pattern of tgPatterns) {
            const match = fullLine.match(pattern);
            if (match) {
              const link = match[1].trim();
              if (!link.toLowerCase().includes("proposta")) {
                return link;
              }
            }
          }

          // Se não encontrou link específico, busca qualquer link que não seja proposta
          const allLinksInTitle = [
            ...fullLine.matchAll(/\((https?:\/\/[^\s)]+)\)/g),
          ];
          for (const linkMatch of allLinksInTitle) {
            const link = linkMatch[1];
            const linkLower = link.toLowerCase();
            if (
              !linkLower.includes("proposta") &&
              (linkLower.includes("/tg/") ||
                linkLower.match(
                  /\.(?:pdf|doc|docx|zip|rar|ps|part\d+\.rar)(?:\.gz)?$/
                ))
            ) {
              return link;
            }
          }
        }

        // 3. Busca em qualquer campo que contenha links de TG
        for (const entry of v) {
          if (!entry?.[0] && !entry?.[1]) continue;

          const text = (entry[1] || entry[0] || "").toString();
          const linkMatch = text.match(/https?:\/\/[^\s)\]]+/);

          if (linkMatch) {
            const link = linkMatch[0];
            const linkLower = link.toLowerCase();
            if (
              !linkLower.includes("proposta") &&
              (linkLower.includes("/tg/") ||
                linkLower.match(
                  /\.(?:pdf|doc|docx|zip|rar|ps|part\d+\.rar)(?:\.gz)?$/
                ))
            ) {
              return link;
            }
          }
        }

        return null;
      }),

      propostaInicial: newRaw2.map((v) => {
        // 1. Busca campo específico primeiro
        let propostaValue = getFieldWithValidation(v, [
          "proposta inicial",
          "proposta",
          "initial proposal",
          "proposta do trabalho",
          "proposta de trabalho",
        ]);

        if (propostaValue) {
          const links = extractAllLinks(propostaValue);
          if (links) return links;
          return propostaValue
            .replace(/proposta\s*(?:inicial)?\s*:\s*/gi, "")
            .trim();
        }

        // 2. Busca na primeira linha numerada (junto com título)
        const firstEntry = v.find(
          (entry) => entry?.[0] && entry[0].match(/^\d+\.\s*/)
        );

        if (firstEntry) {
          const fullLine = firstEntry[0];

          // Padrões para extrair proposta da linha com título (expandidos e case-insensitive)
          const propostaPatterns = [
            // Proposta explícita
            /proposta\s*(?:inicial)?\s*:\s*(https?:\/\/[^\s)\]]+)/i,
            // Texto "(Proposta inicial: link)"
            /\(proposta\s+inicial:\s*(https?:\/\/[^\s)]+)\)/i,
            // Link que contém "proposta" (qualquer formato) - case insensitive
            /\((https?:\/\/[^\s)]*proposta[^\s)]*\.(?:pdf|doc|docx|zip|rar|ps)(?:\.gz)?[^\s)]*)\)/i,
            // Link que contém "proposta" (sem extensão específica)
            /\((https?:\/\/[^\s)]*proposta[^\s)]*)\)/i,
          ];

          for (const pattern of propostaPatterns) {
            const match = fullLine.match(pattern);
            if (match) {
              const link = match[1].trim();
              return link;
            }
          }

          // Busca padrão específico: "aqui" seguido de link de proposta
          const aquiMatch = fullLine.match(
            /\[aqui\]\((https?:\/\/[^\s)]*proposta[^\s)]*)\)/i
          );
          if (aquiMatch) {
            return aquiMatch[1];
          }
        }

        // 3. Busca em qualquer linha por padrões de proposta
        for (const entry of v) {
          if (!entry?.[0] && !entry?.[1]) continue;

          const fullText = (entry[0] || "") + " " + (entry[1] || "");

          // Padrões mais específicos (expandidos para todos os formatos e case-insensitive)
          const propostaPatterns = [
            /proposta\s+inicial[:\s]*[^(]*\(([^)]*proposta[^)]*\.(?:pdf|doc|docx|zip|rar|ps)(?:\.gz)?[^)]*)\)/gi,
            /proposta[:\s]*[^(]*\(([^)]*proposta[^)]*\.(?:pdf|doc|docx|zip|rar|ps)(?:\.gz)?[^)]*)\)/gi,
            /initial\s+proposal[:\s]*[^(]*\(([^)]*proposta[^)]*\.(?:pdf|doc|docx|zip|rar|ps)(?:\.gz)?[^)]*)\)/gi,
            /\(proposta\s+inicial[:\s]*([^)]*\.(?:pdf|doc|docx|zip|rar|ps)(?:\.gz)?[^)]*)\)/gi,
            // Padrão "aqui" com link de proposta
            /\[aqui\]\(([^)]*proposta[^)]*)\)/gi,
            // Padrão genérico para proposta (qualquer formato)
            /proposta[^(]*\(([^)]*proposta[^)]*)\)/gi,
          ];

          for (const pattern of propostaPatterns) {
            const match = fullText.match(pattern);
            if (match && match[1]) {
              const link = match[1].trim();
              if (
                link.toLowerCase().includes("proposta") ||
                link.startsWith("http")
              ) {
                return link;
              }
            }
          }

          // Busca texto que menciona proposta com link
          const text = (entry[1] || entry[0] || "").toString().toLowerCase();
          if (
            text.includes("proposta inicial") ||
            text.includes("initial proposal")
          ) {
            const originalText = (entry[1] || entry[0] || "").toString();
            const linkMatch = originalText.match(/https?:\/\/[^\s)\]]+/);
            if (linkMatch) {
              const link = linkMatch[0];
              if (link.toLowerCase().includes("proposta")) {
                return link;
              }
            }
          }
        }

        // 4. Último recurso: busca por qualquer link que claramente é de proposta
        for (const entry of v) {
          if (!entry?.[0] && !entry?.[1]) continue;

          const text = (entry[1] || entry[0] || "").toString();
          const linkMatch = text.match(/https?:\/\/[^\s)\]]+/);

          if (linkMatch) {
            const link = linkMatch[0];
            const linkLower = link.toLowerCase();
            // Só considera se o link claramente é de proposta
            if (linkLower.includes("proposta") && !linkLower.includes("/tg/")) {
              return link;
            }
          }
        }

        return null;
      }),
      course: newRaw2.map((v) => {
        const courseValue = getFieldWithValidation(v, [
          "curso",
          "course",
          "cursos",
        ]);

        if (!courseValue) {
          for (const entry of v) {
            if (!entry?.[0]) continue;
            const line = entry[0].toLowerCase();
            if (
              line.includes("ciência da computação") ||
              line.includes("engenharia da computação") ||
              line.includes("sistemas de informação") ||
              line.includes("ciencia da computacao") ||
              line.includes("engenharia da computacao") ||
              line.includes("sistemas de informacao")
            ) {
              return entry[0].trim();
            }
          }
        }

        return courseValue;
      }),

      autor: newRaw2.map((v) => {
        // Múltiplas estratégias para encontrar o autor
        let autorValue = null;

        // 1. Busca padrão com getFieldWithValidation
        autorValue = getFieldWithValidation(v, [
          "autor",
          "author",
          "aluno",
          "aluna",
          "autora",
          "autoras",
          "alunos",
          "alunas",
          "autor(a)",
          "autor\\(a\\)",
        ]);

        // 2. Se não encontrou, busca mais diretamente nas linhas
        if (!autorValue) {
          for (const entry of v) {
            if (!entry?.[0]) continue;

            const line = entry[0].toLowerCase().trim();
            if (
              line.includes("autor") ||
              line.includes("author") ||
              line.includes("aluno") ||
              line.includes("aluna")
            ) {
              autorValue = entry[1] || entry[0];
              break;
            }
          }
        }

        // 3. Busca por padrão "Autor: Nome" ou "**Autor: Nome**"
        if (!autorValue) {
          for (const entry of v) {
            if (!entry?.[0]) continue;

            const fullLine = entry[0];
            const autorMatch = fullLine.match(
              /\*{0,2}autor(?:\(a\))?\s*:\s*(.+?)\*{0,2}$/i
            );
            if (autorMatch) {
              autorValue = autorMatch[1].trim();
              break;
            }
          }
        }

        if (!autorValue) return null;

        // Limpeza do valor encontrado
        let cleanAutor = autorValue;

        // Remove prefixos comuns
        cleanAutor = cleanAutor
          .replace(/^autor(?:\(a\))?\s*:\s*/gi, "")
          .replace(/^author\s*:\s*/gi, "")
          .replace(/^aluno(?:a)?\s*:\s*/gi, "");

        // Extrai texto entre colchetes se houver
        const bracketText = extractBracketText(cleanAutor);
        if (bracketText && bracketText !== cleanAutor) {
          cleanAutor = bracketText;
        }

        // Limpeza final
        cleanAutor = cleanAutor
          .replace(/\*\*/g, "")
          .replace(/_/g, "")
          .replace(/^\*+/, "")
          .replace(/\*+$/, "")
          .trim();

        return cleanAutor || null;
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
          "possíveis avaliador",
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

          const isRealField = (text, fieldList) => {
            if (!text) return false;

            return fieldList.some((field) => {
              // Verifica se é exatamente o campo seguido de ":"
              const exactMatch = text.match(new RegExp(`^${field}\\s*:`, "i"));
              if (exactMatch) return true;

              // Verifica se a linha inteira é só o campo (sem conteúdo)
              const fieldOnlyMatch = text.match(
                new RegExp(`^${field}\\s*$`, "i")
              );
              if (fieldOnlyMatch) return true;

              return false;
            });
          };

          // Campos que indicam fim do resumo (mais específicos)
          const endFields = [
            "apresentação",
            "apresentacao",
            "defesa",
            "nota final",
            "palavras-chave",
            "palavras chave",
            "key words",
            "banca",
            "data",
            "hora/local",
            "área",
            "area",
          ];

          if (i === resumoIndex) {
            if (entry[1]) {
              resumoLines.push(entry[1]);
            }
            continue;
          }

          const isEndField =
            isRealField(fieldName, endFields) ||
            isRealField(entry?.[0], endFields);

          const isNewField = possibleFields.some((field) => {
            if (!fieldName) return false;
            // Só considera novo campo se tiver ":" ou for exatamente o campo
            return (
              fieldName === field.toLowerCase() &&
              (entry?.[0]?.includes(":") ||
                fieldName === entry?.[0]?.toLowerCase().trim())
            );
          });

          if (isEndField || isNewField) break;

          if (
            entry[0] &&
            entry[0].toLowerCase().match(/^apresenta[çc][ãa]o\s*:/)
          ) {
            break;
          }

          if (entry[0] && entry[0].toLowerCase().includes("nota final")) {
            break;
          }

          const content = entry?.[1] || entry?.[0] || "";
          if (content && content.trim() !== "") {
            resumoLines.push(content);
          }
        }

        let resumoText = resumoLines.join(" ").replace(/\n+/g, " ").trim();

        resumoText = resumoText
          .replace(/apresenta[çc][ãa]o\s*:.*$/i, "") // Remove apresentação e tudo após
          .replace(/defesa\s*:.*$/i, "") // Remove defesa e tudo após
          .replace(/nota final\s*:.*$/i, "") // Remove nota final e tudo após
          .replace(/palavras[- ]chave\s*:.*$/i, "") // Remove palavras-chave e tudo após
          .trim();

        return resumoText || null;
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

      horaLocal: newRaw2.map((v) =>
        getFieldWithValidation(v, ["hora/local", "local"])
      ),

      local: newRaw2.map((v) => getFieldWithValidation(v, ["local", "Local"])),

      area: newRaw2.map((v) => {
        const areaValue = getFieldWithValidation(v, ["area", "área"]);

        if (!areaValue) {
          for (const entry of v) {
            if (!entry?.[0]) continue;
            const line = entry[0].toLowerCase();
            if (
              line.includes("banco de dados") ||
              line.includes("engenharia de software") ||
              line.includes("redes") ||
              line.includes("processamento de imagem") ||
              line.includes("inteligência artificial") ||
              line.includes("realidade virtual") ||
              line.includes("sistemas distribuídos") ||
              line.includes("qualidade de software")
            ) {
              return entry[0].trim();
            }
          }
        }

        return areaValue;
      }),

      nota_final: newRaw2.map((v) => {
        const notaValue = getFieldWithValidation(v, ["nota final"]);
        if (notaValue) {
          return extractNotaFinal(notaValue);
        }

        const rawText = v
          .map((entry) => (entry[0] || "") + " " + (entry[1] || ""))
          .join(" ");

        const notaPatterns = [
          /nota final[:\s]*([\d.,]+)\s*\([^)]*detalhamento[^)]*\)/gi, // "Nota final: 8,0 ([detalhamento])"
          /\*\*\*nota final[:\s]*([\d.,]+)\s*\([^)]*detalhamento[^)]*\)\*\*\*/gi, // ***Nota final: 8,0 ([detalhamento])***
          /\*\*nota final[:\s]*([\d.,]+)\s*\([^)]*detalhamento[^)]*\)\*\*/gi, // **Nota final: 8,0 ([detalhamento])**
          /nota final[:\s]*([\d.,]+)\s*\(/gi, // "Nota final: 8,0 ("
          /\*\*nota final[:\s]*([\d.,]+)\*\*/gi, // **Nota final: 8,0**
          /\*\*\*nota final[:\s]*([\d.,]+)\*\*\*/gi, // ***Nota final: 8,0***
          /nota final[:\s]*([\d.,]+)/gi, // "Nota final: 8,0"
          /([\d.,]+)\s*\(\[detalhamento\]/gi, // "8,0 ([detalhamento"
          /^([\d.,]+)\s*\([^)]*detalhamento[^)]*\)/gim, // "8,0 ([detalhamento...])" no início da linha
        ];

        for (const pattern of notaPatterns) {
          const matches = [...rawText.matchAll(pattern)];
          if (matches.length > 0) {
            // Pega a última ocorrência (mais provável de ser a nota final)
            const lastMatch = matches[matches.length - 1];
            if (lastMatch[1]) {
              const nota = lastMatch[1].replace(",", ".").trim();
              const numero = parseFloat(nota);
              if (!isNaN(numero) && numero >= 0 && numero <= 10) {
                return nota;
              }
            }
          }
        }

        if (
          rawText.match(/nota final[:\s]*faltou/i) ||
          rawText.match(/nota final[:\s]*\?[,.]?\?/i) ||
          rawText.match(/nota final[:\s]*-[,.]?-/i) ||
          rawText.match(/nota final[:\s]*\\-[,.]?-/i) ||
          rawText.match(/nota final[:\s]*\?\s*$/i) ||
          rawText.match(/nota final[:\s]*-\s*$/i)
        ) {
          return null;
        }

        if (
          rawText.match(/nota final[:\s]*-[,.]?-/i) ||
          rawText.match(/nota final[:\s]*\\-[,.]?-/i)
        ) {
          return null; // Não definido
        }

        const genericMatch = rawText.match(
          /([\d.,]+)\s*\([^)]*detalhamento[^)]*\)/i
        );
        if (genericMatch) {
          const nota = genericMatch[1].replace(",", ".").trim();
          const numero = parseFloat(nota);
          if (!isNaN(numero) && numero >= 0 && numero <= 10) {
            return nota;
          }
        }

        return null;
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
    "proposta",
    "initial proposal",
    "autor",
    "author",
    "autora",
    "autoras",
    "aluno",
    "aluna",
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
    "banca examinadora",
    "data",
    "hora/local",
    "área",
    "area",
    "nota final",
    "nota",
  ];
  const camposVaziosRegex = new RegExp(
    `^.*(${possibleFields.join("|")})\\s*:\\s*$`,
    "gim"
  );

  for (const record of allRecords) {
    let raw = record.raw;
    let semester = record.semester;

    const camposVaziosRegex = new RegExp(
      `^.*(${possibleFields.join("|")})\\s*:\\s*$`,
      "gim"
    );
    raw = raw.replace(camposVaziosRegex, "");
    raw = raw.replace(/^\s*\d+\.\s*$/gm, "");

    // Pré-processa o resumo para separar apresentação
    let apresentacaoText = null;
    let defesaText = null;
    let resumoText = raw.trim();

    // Regex para encontrar apresentação dentro do resumo
    const apresentacaoRegex = /(apresenta[cç][aã]o\s*:\s*.+)$/im;
    const apresentacaoMatch = raw.match(apresentacaoRegex);

    if (apresentacaoMatch) {
      apresentacaoText = apresentacaoMatch[1].trim();
      // Remove apresentação do resumo
    }

    // Regex para encontrar defesa dentro do resumo
    const defesaRegex = /(defesa\s*:\s*.+)$/im;
    const defesaMatch = raw.match(defesaRegex);

    if (defesaMatch) {
      defesaText = defesaMatch[1].trim();
      // Remove defesa do resumo se não foi capturada como apresentação
      if (!apresentacaoText) {
        resumoText = resumoText.replace(defesaRegex, "").trim();
      }
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

      const split = cleanLine.split(/:(.+)/, 2);
      if (split.length > 1) {
        const fieldName = split[0].replace(/^\*+/, "").trim().toLowerCase();
        const value = split[1].trim();
        return [fieldName, value];
      }

      return [cleanLine.toLowerCase(), ""];
    });

    if (apresentacaoText) {
      mappedLines.push(["apresentação", apresentacaoText]);
    }

    if (defesaText && defesaText !== apresentacaoText) {
      mappedLines.push(["defesa", defesaText]);
    }

    const notaFinalRegex = /nota final\s*:\s*([\d.,]+)/i;
    const notaFinalMatch = raw.match(notaFinalRegex);

    let notaFinalValue = null;
    if (notaFinalMatch) {
      notaFinalValue = notaFinalMatch[1].replace(",", ".").trim();
    }

    const fields = mapFieldsFromRaw([mappedLines], possibleFields);

    if (fields.titulo?.[0]) {
      const regexTituloLinha = /^.*(t[ií]tulo|title)\s*:\s*.*$/gim;
      raw = raw.replace(regexTituloLinha, "");
      raw = raw.replace(/^.*(t[ií]tulo|title)\s*:\s*$/gim, "");
      raw = raw.replace(/^\s*\d+\.\s*.*$/gm, "");
    }

    if (fields.tg?.[0]) {
      const regexTGLinha =
        /^.*(tg|trabalho de graduação|trabalho de graduaçao|trabalho de graduacao|tg final)\s*:.*$/gim;
      raw = raw.replace(regexTGLinha, "");
    }
    const regexTGVazio = /^.*\bTG\s*:\s*$/gim;
    raw = raw.replace(regexTGVazio, "");

    if (fields.autor?.[0]) {
      const regexAutorLinha = new RegExp(
        [
          /^.*autor(?:\(a\))?\s*:\s*.+$/,
          /^\*+.*autor(?:\(a\))?\s*:\s*.+\*+$/,
          /^.*author\s*:\s*.+$/,
          /^.*aluno[as]?\s*:\s*.+$/,
          /^.*aluna?\s*:\s*.+$/,
          /^.*autoras?\s*:\s*.+$/,
          /^_.*autor(?:\(a\))?\s*:\s*.+_$/,
        ]
          .map((r) => r.source)
          .join("|"),
        "gim"
      );

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
        "avaliador(a)",
        "avaliadora(a)",
        "avaliador \\(a confirmar\\)",
        "possíveis avaliadores(as)",
        "avaliadores(as)",
      ];
      const regexAvaliadoresLinha = new RegExp(
        `^.*(${possibleStrings.join("|")})\\s*\\s*.*$`,
        "gim"
      );
      raw = raw.replace(regexAvaliadoresLinha, "");
      raw = raw.replace(
        /^.*(avaliadores|possíveis avaliadores|avaliador|avaliadora|avaliador\(a\)|avaliadora\(a\)|avaliador \(a confirmar\)|possíveis avaliadores\(as\)|avaliadores\(as\))\s*:\s*$/gim,
        ""
      );
    }
    if (fields.resumoDaProposta?.[0]) {
      const regexResumoLinha = /^.*resumo(?: da proposta)?\s*:\s*.*$/gim;
      raw = raw.replace(regexResumoLinha, "");
    }
    if (fields.propostaInicial?.[0]) {
      const regexPropostaInicialLinha =
        /^.*(proposta(?:\s+inicial)?|initial proposal)\s*:\s*.*$/gim;
      raw = raw.replace(regexPropostaInicialLinha, "");
      raw = raw.replace(
        /^.*(proposta(?:\s+inicial)?|initial proposal)\s*:\s*$/gim,
        ""
      );
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
        /^.*(banca|banca examinadora|bancas|bancas examinadoras)\s*:\s*.*$/gim;
      raw = raw.replace(regexBancaLinha, "");
      raw = raw.replace(
        /^.*(banca|banca examinadora|bancas|bancas examinadoras)\s*:\s*$/gim,
        ""
      );
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
      // Verifica se a nota final é válida
      const notaFinalValidada = extractNotaFinal(fields.nota_final[0]);

      if (notaFinalValidada === null) {
        // Se a nota não é válida, remove ela do raw
        const regexNotaFinalInvalida =
          /^.*nota final\s*:\s*[\?\-,\.]*[\?\-]*.*$/gim;
        raw = raw.replace(regexNotaFinalInvalida, "");

        // Remove linhas que contêm apenas símbolos inválidos para nota
        raw = raw.replace(
          /^.*[\?\-,\.]+\s*\([^)]*detalhamento[^)]*\).*$/gim,
          ""
        );

        // Remove linhas vazias resultantes
        raw = raw.replace(/^\s*$/gm, "");
      } else {
        // Se é válida, remove apenas a linha da nota final normal
        const regexNotaFinalLinha = /^.*nota final\s*:\s*.*$/gim;
        raw = raw.replace(regexNotaFinalLinha, "");
      }
    } else {
      const regexNotaFinalInvalida =
        /^.*nota final\s*:\s*[\?\-,\.]*[\?\-]*.*$/gim;
      raw = raw.replace(regexNotaFinalInvalida, "");
      raw = raw.replace(/^.*[\?\-,\.]+\s*\([^)]*detalhamento[^)]*\).*$/gim, "");
    }

    if (fields.local?.[0]) {
      const regexLocalLinha =
        /^.*(local|Local|sala|Sala|auditório|auditorio|anfiteatro|google meet|meet)\s*:\s*.*$/gim;
      raw = raw.replace(regexLocalLinha, "");

      raw = raw.replace(/^.*(local|Local)\s*:\s*$/gim, "");

      raw = raw.replace(/^.*sala\s+[A-Z0-9]+.*$/gim, "");
      raw = raw.replace(/^.*auditório.*$/gim, "");
      raw = raw.replace(/^.*anfiteatro.*$/gim, "");
      raw = raw.replace(/^.*google\s+meet.*$/gim, "");
      raw = raw.replace(/^.*pitch.*$/gim, "");
      raw = raw.replace(/^.*online.*$/gim, "");
      raw = raw.replace(/^.*virtual.*$/gim, "");
      raw = raw.replace(/^.*remoto.*$/gim, "");

      raw = raw.replace(/^[A-Z]\d{3}$/gm, "");
      raw = raw.replace(/^[A-Z]-\d{3}$/gm, "");
    }

    raw = raw.trim() === "" ? null : raw.trim();

    const apresentacaoValue =
      fields.apresentacao?.[0] || fields.horaLocal?.[0] || "";
    let day = null,
      hour = null,
      local = null;

    const localFromField = fields.local?.[0];
    if (localFromField) {
      local = localFromField
        .replace(/local[:\s]*/i, "")
        .replace(/\([^)]*detalhamento[^)]*\)/gi, "")
        .replace(/nota final.*/gi, "")
        .trim();

      if (local && local.length >= 3) {
        console.log("Local encontrado em campo dedicado:", local);
      } else {
        local = null;
      }
    }

    if (apresentacaoValue) {
      let value = apresentacaoValue
        .replace(/\s+/g, " ")
        .replace(/[\*]+/g, "")
        .trim();

      value = value.replace(/nota final[:\s]*[\d.,]+\s*\([^)]*\)/gi, "");

      const dayMatch = value.match(
        /dia[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})|(\d{1,2}\/\d{1,2}\/\d{2,4})/i
      );
      day = dayMatch ? dayMatch[1] || dayMatch[2] : null;

      const hourMatch =
        value.match(
          /hora[:\s]*(\d{1,2}:\d{2}(?:h)?(?:s)?(?:\s*às\s*\d{1,2}:\d{2}(?:h)?(?:s)?)?)/i
        ) ||
        value.match(
          /(\d{1,2}:\d{2}(?:h)?(?:s)?(?:\s*às\s*\d{1,2}:\d{2}(?:h)?(?:s)?)?)/i
        ) ||
        value.match(/(\d{1,2}h(?:\d{2})?(?:s)?)/i);
      hour = hourMatch ? hourMatch[1] : null;

      const localMatch =
        value.match(/local[:\s]*([^,\n]+?)(?:\s*$|,|nota final)/i) ||
        value.match(
          /((?:sala|auditório|anfiteatro)[:\s]*[^,\n]+?)(?:\s*$|,|nota final)/i
        ) ||
        value.match(/(sala\s+[A-Z0-9]+[^,\n]*?)(?:\s*$|,|nota final)/i) ||
        value.match(/(auditório\s+[^,\n]+?)(?:\s*$|,|nota final)/i) ||
        value.match(/(anfiteatro\s+[^,\n]+?)(?:\s*$|,|nota final)/i) ||
        value.match(
          /((?:via\s+)?google\s+meet[^,\n]*?)(?:\s*$|,|nota final)/i
        ) || // "via Google Meet" ou "Google Meet"
        value.match(
          /((?:através\s+do\s+)?google\s+meet[^,\n]*?)(?:\s*$|,|nota final)/i
        ) || // "através do Google Meet"
        value.match(
          /((?:por\s+)?google\s+meet[^,\n]*?)(?:\s*$|,|nota final)/i
        ) || // "por Google Meet"
        value.match(
          /((?:pelo\s+)?google\s+meet[^,\n]*?)(?:\s*$|,|nota final)/i
        ) || // "pelo Google Meet"
        value.match(/(meet\s+google[^,\n]*?)(?:\s*$|,|nota final)/i) || // "Meet Google" (ordem invertida)
        value.match(/(online[^,\n]*?)(?:\s*$|,|nota final)/i) || // "online"
        value.match(/(virtual[^,\n]*?)(?:\s*$|,|nota final)/i) || // "virtual"
        value.match(/(remoto[^,\n]*?)(?:\s*$|,|nota final)/i); // "remoto"

      console.log("value: ", value);
      if (localMatch) {
        local = localMatch[1].trim();
        // if (record?.author.startsWith("Saulo Alexandre")) {
        //   console.log("Local para Saulo Alexandre Barros:", local);
        // }
      } else {
        const parts = value.split(",").map((p) => p.trim());
        if (parts.length > 2) {
          const lastPart = parts[parts.length - 1];
          if (
            !lastPart.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/) &&
            !lastPart.match(/\d{1,2}:\d{2}/) &&
            !lastPart.match(/\d{1,2}h/) &&
            !lastPart.match(/nota final/i) &&
            !lastPart.match(/detalhamento/i) &&
            lastPart.length > 3 &&
            lastPart.length < 100
          ) {
            local = lastPart;
          }
        }
      }
      if (local) {
        local = local
          .replace(/\([^)]*detalhamento[^)]*\)/gi, "")
          .replace(/nota final.*/gi, "")
          .trim();

        if (!local || local.length < 3) {
          local = null;
        }
      }
    }

    if (fields.local) console.log("record.author: " + record.author);
    console.log("fields.autor: ", fields.autor);
    console.log("local: ", local);

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
