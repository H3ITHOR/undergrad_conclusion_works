import puppeteer from "puppeteer";

(async () => {
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
    "body > div > div:nth-child(12) > table > tbody > tr:nth-child(1) > td:nth-child(1) > h3 > u > span > a";
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
      .replace(/Resumo da Proposta:<\/b>\n/g, "Resumo da Proposta:</b>")
      .replace(/\n/g, " ")
      .trim()
      .split("<br><b>")
      .map((v1) =>
        v1
          .trim()
          .replaceAll("<b>", "")
          .replaceAll("<br>", "")
          .split("</b>")
          .map((v1) => {
            if (v1.trim().startsWith("<a"))
              return `https://cin.ufpe.br/~tg/2024-1/${(
                v1.match(/href="([^"]*)"/)?.[1] || ""
              )
                .replaceAll('"', "")
                .replace("href=", "")}`;
            return v1.trim();
          })
      )
  );

  const raw = elementsArray;

  const titulo = newRaw2.map((v) => v[0][1]);
  const tg = newRaw2.map((v) => v[1][1]);
  const propostaInicial = newRaw2.map((v) => v[2][1]);
  const autor = newRaw2.map((v) => v[3][1]);
  const curso = newRaw2.map((v) => v[4][1]);
  const orientador = newRaw2.map((v) => v[5][1]);
  const coorientador = newRaw2.map((v) => v[6][1]);
  const possiveisAvaliadores = newRaw2.map((v) => v[7][1]);
  const resumoDaProposta = newRaw2.map((v) => v[8][1]);
  const apresentacao = newRaw2.map((v) => v[9][1]);
  const banca = newRaw2.map((v) => v[10][1]);

  await browser.close();
})();
