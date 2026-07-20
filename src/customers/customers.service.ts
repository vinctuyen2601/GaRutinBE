import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,
  ) {}

  async findByPhone(phone: string): Promise<Customer | null> {
    return this.repo.findOne({ where: { phone } });
  }

  async create(phone: string, name?: string, address?: string): Promise<Customer> {
    const existing = await this.repo.findOne({ where: { phone }, withDeleted: true });
    if (existing) throw new ConflictException('Số điện thoại đã tồn tại');
    return this.repo.save(this.repo.create({ phone, name, address }));
  }

  async findDeleted(): Promise<Customer[]> {
    return this.repo
      .createQueryBuilder('c')
      .withDeleted()
      .where('c.deleted_at IS NOT NULL')
      .orderBy('c.deleted_at', 'DESC')
      .getMany();
  }

  async softDelete(id: string): Promise<void> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Không tìm thấy khách hàng');
    await this.repo.softDelete(id);
  }

  async findAll(search?: string): Promise<Array<Customer & { orderCount: number; totalSpent: number }>> {
    const params: unknown[] = [];
    let whereExtra = '';
    if (search) {
      params.push(`%${search}%`);
      whereExtra = ` AND (c.phone ILIKE $${params.length} OR c.name ILIKE $${params.length})`;
    }

    const sql = `
      SELECT
        c.id,
        c.phone,
        c.name,
        c.address,
        c.created_at AS "createdAt",
        c.updated_at AS "updatedAt",
        COUNT(DISTINCT o.id)::int                 AS "orderCount",
        COALESCE(SUM(o.total_amount), 0)::numeric AS "totalSpent"
      FROM customers c
      LEFT JOIN orders o
        ON o.customer_phone = c.phone
       AND o.status != 'cancelled'
      WHERE c.deleted_at IS NULL${whereExtra}
      GROUP BY c.id
      ORDER BY "orderCount" DESC, c.updated_at DESC
    `;

    return this.repo.query(sql, params);
  }

  async findById(id: string): Promise<Customer> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Không tìm thấy khách hàng');
    return c;
  }

  async update(id: string, dto: { name?: string; address?: string; phone?: string }): Promise<Customer> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Không tìm thấy khách hàng');
    if (dto.name !== undefined) c.name = dto.name;
    if (dto.address !== undefined) c.address = dto.address;
    if (dto.phone !== undefined) c.phone = dto.phone;
    return this.repo.save(c);
  }

  async upsert(phone: string, name?: string, address?: string): Promise<Customer> {
    const existing = await this.repo.findOne({ where: { phone } });
    if (existing) {
      if (name) existing.name = name;
      if (address) existing.address = address;
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({ phone, name, address }));
  }
}
