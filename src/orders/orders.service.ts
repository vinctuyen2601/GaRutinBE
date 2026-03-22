import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
  ) {}

  private generateOrderNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `GR${date}${rand}`;
  }

  async create(dto: CreateOrderDto): Promise<Order> {
    const totalAmount = dto.totalAmount ??
      dto.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const order = this.repo.create({
      ...dto,
      orderNumber: this.generateOrderNumber(),
      totalAmount,
      source: dto.source ?? 'web',
    });
    return this.repo.save(order);
  }

  findAll(params: { status?: string; page?: number; limit?: number } = {}): Promise<Order[]> {
    const qb = this.repo.createQueryBuilder('o').orderBy('o.created_at', 'DESC');
    if (params.status) qb.where('o.status = :status', { status: params.status });

    const limit = params.limit ?? 20;
    const page = params.page ?? 1;
    qb.take(limit).skip((page - 1) * limit);

    return qb.getMany();
  }

  async findById(id: string): Promise<Order> {
    const order = await this.repo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.findById(id);
    order.status = dto.status;
    return this.repo.save(order);
  }
}
