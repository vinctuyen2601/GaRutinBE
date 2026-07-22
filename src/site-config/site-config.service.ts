import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteConfig } from './entities/site-config.entity';

// Config keys that must never appear in the public GET /site-config response
// (consumed by the storefront with no auth) — only exposed via the admin endpoint.
const PRIVATE_KEYS = new Set(['order_alert_email']);

@Injectable()
export class SiteConfigService {
  constructor(
    @InjectRepository(SiteConfig)
    private readonly repo: Repository<SiteConfig>,
  ) {}

  async findAll(): Promise<Record<string, string>> {
    const items = await this.repo.find();
    return Object.fromEntries(
      items.filter((i) => !PRIVATE_KEYS.has(i.key)).map((i) => [i.key, i.value]),
    );
  }

  async findAllAdmin(): Promise<Record<string, string>> {
    const items = await this.repo.find();
    return Object.fromEntries(items.map((i) => [i.key, i.value]));
  }

  async get(key: string): Promise<string | null> {
    const item = await this.repo.findOne({ where: { key } });
    return item?.value ?? null;
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
