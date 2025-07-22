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

  async getAll(data: ScrapedData): Promise<ScrapedData[]> {
    return await this.prisma.data.findMany();
  }

  async saveMany(dataArray: ScrapedData[]): Promise<any> {
    return await this.prisma.data.createMany({
      data: dataArray,
      skipDuplicates: true,
    });
  }

  async deleteByField(field: string, value: string): Promise<any> {
    return await this.prisma.data.deleteMany({
      where: {
        [field]: value,
      },
    });
  }

  async deleteByMultipleFields(conditions: any): Promise<any> {
    return await this.prisma.data.deleteMany({
      where: conditions,
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
