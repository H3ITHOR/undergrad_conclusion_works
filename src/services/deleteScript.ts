import { DataRepository } from "../repositories/scrapingRepository";

(async () => {
  try {
    const data = new DataRepository();
    await data.deleteByMultipleFields({});
  } catch (error) {
    console.log(error);
  } finally {
    console.log("dados removidos com sucesso");
  }
})();
