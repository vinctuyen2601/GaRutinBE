import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Order } from './entities/order.entity';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { CustomersService } from '../customers/customers.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
    private readonly customersService: CustomersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private generateOrderNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `GR${date}${rand}`;
  }

  async create(dto: CreateOrderDto): Promise<Order> {
    if (dto.customerPhone) {
      await this.customersService.upsert(dto.customerPhone, dto.customerName, dto.customerAddress);
    }

    const totalAmount = dto.totalAmount ??
      dto.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const order = this.repo.create({
      ...dto,
      orderNumber: this.generateOrderNumber(),
      totalAmount,
      source: dto.source ?? 'web',
    });
    const saved = await this.repo.save(order);

    // Phát sự kiện thay vì gọi thẳng dịch vụ gửi mail: từ nay chủ trại tự
    // khai kênh nhận (Telegram / Zalo / Email) trong CMS, và một đơn có thể
    // báo về nhiều nơi cùng lúc. Gửi thất bại không được làm hỏng việc tạo đơn.
    this.eventEmitter.emit('order.created', saved);

    return saved;
  }

  findAll(params: { status?: string; page?: number; limit?: number } = {}): Promise<Order[]> {
    const qb = this.repo.createQueryBuilder('o').orderBy('o.created_at', 'DESC');
    if (params.status) qb.where('o.status = :status', { status: params.status });

    const limit = params.limit ?? 20;
    const page = params.page ?? 1;
    qb.take(limit).skip((page - 1) * limit);

    return qb.getMany();
  }

  findByPhone(phone: string): Promise<Order[]> {
    return this.repo.find({
      where: { customerPhone: phone },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Order> {
    const order = await this.repo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.findById(id);
    // Giữ lại trạng thái cũ TRƯỚC khi ghi đè: thông báo hiển thị "cũ → mới",
    // đọc sau khi gán thì hai đầu mũi tên giống hệt nhau.
    const previousStatus = order.status;
    order.status = dto.status;
    const saved = await this.repo.save(order);

    if (previousStatus !== saved.status) {
      this.eventEmitter.emit('order.status_updated', { ...saved, previousStatus });
    }
    return saved;
  }
}
