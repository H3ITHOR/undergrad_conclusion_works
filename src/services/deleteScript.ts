import { DataRepository } from "../repositories/scrapingRepository";

(async () => {
  try {
    const data = new DataRepository();
    await data.deleteByMultipleFields({
      course: "Ciência da Computação",
      semester: "2023-1",
    });
  } catch (error) {
    console.log(error);
  } finally {
    console.log("dados removidos com sucesso");
  }
})();
