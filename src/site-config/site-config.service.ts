import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteConfig } from './entities/site-config.entity';

@Injectable()
export class SiteConfigService {
  constructor(
    @InjectRepository(SiteConfig)
    private readonly repo: Repository<SiteConfig>,
  ) {}

  async findAll(): Promise<Record<string, string>> {
    const items = await this.repo.find();
    return Object.fromEntries(items.map((i) => [i.key, i.value]));
  }

  async upsert(key: string, value: string): Promise<SiteConfig> {
    let item = await this.repo.findOne({ where: { key } });
    if (item) {
      item.value = value;
    } else {
      item = this.repo.create({ key, value });
    }
    return this.repo.save(item);
  }
}
