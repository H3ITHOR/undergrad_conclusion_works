import { DataRepository } from "../repositories/scrapingRepository";

(async () => {
  try {
    const data = new DataRepository();
    await data.deleteByMultipleFields({
      course: "Sistemas de Informação",
      semester: "2024-1",
    });
  } catch (error) {
    console.log(error);
  } finally {
    console.log("dados removidos com sucesso");
  }
})();
