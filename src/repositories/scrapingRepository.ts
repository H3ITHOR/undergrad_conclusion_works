import { PrismaClient } from "@prisma/client";
import { ScrapedData } from "../types/scraping.types";

export class DataRepository {
  private readonly prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async save(data: ScrapedData): Promise<ScrapedData> {
    return await this.prisma.data.create({
      data: data,
    });
  }

  async saveMany(dataArray: ScrapedData[]): Promise<any> {
    return await this.prisma.data.createMany({
      data: dataArray,
      skipDuplicates: true,
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
