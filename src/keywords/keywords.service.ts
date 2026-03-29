import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Keyword } from './entities/keyword.entity';
import { CreateKeywordDto, UpdateKeywordDto } from './dto/keyword.dto';

@Injectable()
export class KeywordsService {
  constructor(
    @InjectRepository(Keyword)
    private readonly repo: Repository<Keyword>,
  ) {}

  findAll(): Promise<Keyword[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findActive(): Promise<Keyword | null> {
    return this.repo.findOne({ where: { isActive: true } });
  }

  async create(dto: CreateKeywordDto): Promise<Keyword> {
    const kw = this.repo.create({ ...dto, isActive: false });
    return this.repo.save(kw);
  }

  async update(id: string, dto: UpdateKeywordDto): Promise<Keyword> {
    const kw = await this.repo.findOne({ where: { id } });
    if (!kw) throw new NotFoundException('Keyword không tồn tại');
    Object.assign(kw, dto);
    return this.repo.save(kw);
  }

  async setActive(id: string): Promise<Keyword> {
    const kw = await this.repo.findOne({ where: { id } });
    if (!kw) throw new NotFoundException('Keyword không tồn tại');

    // Deactivate tất cả, activate cái được chọn
    await this.repo.update({}, { isActive: false });
    kw.isActive = true;
    return this.repo.save(kw);
  }

  async deactivate(id: string): Promise<Keyword> {
    const kw = await this.repo.findOne({ where: { id } });
    if (!kw) throw new NotFoundException('Keyword không tồn tại');
    kw.isActive = false;
    return this.repo.save(kw);
  }

  async remove(id: string): Promise<void> {
    const kw = await this.repo.findOne({ where: { id } });
    if (!kw) throw new NotFoundException('Keyword không tồn tại');
    if (kw.isActive) throw new BadRequestException('Không thể xóa keyword đang active');
    await this.repo.delete(id);
  }

  async markCrawled(id: string): Promise<void> {
    await this.repo.increment({ id }, 'crawlCount', 1);
    await this.repo.update(id, { lastCrawledAt: new Date() });
  }
}
