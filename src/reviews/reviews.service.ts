import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Review } from './entities/review.entity';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';
import { Product } from '../products/entities/product.entity';

/** Mã lỗi Postgres khi vi phạm ràng buộc duy nhất. */
const TRUNG_KHOA = '23505';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectRepository(Review)
    private readonly repo: Repository<Review>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Tính lại điểm trung bình và số đánh giá của sản phẩm.
   *
   * Chỉ đếm đánh giá ĐÃ DUYỆT — nếu không thì đánh giá spam chưa duyệt vẫn kéo
   * điểm sao trên trang xuống ngay lập tức, đúng thứ mà bước duyệt sinh ra để
   * ngăn.
   */
  private async capNhatThongKe(productId: string): Promise<void> {
    const r = await this.repo
      .createQueryBuilder('r')
      .select('AVG(r.rating::float)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('r.product_id = :productId AND r.is_approved = true', { productId })
      .getRawOne<{ avg: string | null; count: string }>();

    await this.productRepo.update(productId, {
      avgRating: r?.avg ? Number(Number(r.avg).toFixed(2)) : null,
      reviewCount: Number(r?.count ?? 0),
    } as any);
  }

  /**
   * Khách gửi đánh giá. Luôn ở trạng thái chờ duyệt.
   *
   * Chặn trùng dựa vào chỉ mục duy nhất của CSDL chứ không kiểm trước rồi mới
   * ghi: hai lần bấm gửi sát nhau thì phép kiểm ở tầng ứng dụng đọc trước khi
   * cái kia ghi xong và cả hai đều lọt.
   */
  async create(dto: CreateReviewDto, ip: string | null): Promise<Review> {
    const sanPham = await this.productRepo.findOne({ where: { id: dto.productId } });
    if (!sanPham) throw new NotFoundException('Sản phẩm không tồn tại');

    try {
      const review = await this.repo.save(
        this.repo.create({
          ...dto,
          images: dto.images ?? [],
          video: dto.video ?? null,
          isApproved: false,
          ip,
        } as any),
      ) as unknown as Review;

      this.eventEmitter.emit('review.created', { ...review, productName: sanPham.name });
      return review;
    } catch (err: any) {
      if (err?.code === TRUNG_KHOA) {
        throw new ConflictException(
          'Bạn đã gửi đánh giá cho sản phẩm này rồi. Mỗi người chỉ gửi được một lần.',
        );
      }
      throw err;
    }
  }

  /** Công khai: chỉ đánh giá đã duyệt, mới nhất trước. */
  findByProduct(productId: string): Promise<Review[]> {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(productId)) return Promise.resolve([]);
    return this.repo.find({
      where: { productId, isApproved: true },
      order: { createdAt: 'DESC' },
      // Không trả IP ra ngoài: đó là dữ liệu của người gửi, người đọc trang
      // không có lý do gì để biết.
      select: ['id', 'productId', 'customerName', 'rating', 'comment', 'images', 'video', 'createdAt'],
    });
  }

  /** Quản trị: xem tất cả, lọc theo trạng thái duyệt. */
  async findAllForAdmin(trangThai?: 'pending' | 'approved'): Promise<any[]> {
    const qb = this.repo
      .createQueryBuilder('r')
      .leftJoin(Product, 'p', 'p.id = r.product_id')
      .addSelect(['p.name AS product_name', 'p.slug AS product_slug'])
      .orderBy('r.created_at', 'DESC')
      .limit(300);

    if (trangThai === 'pending') qb.where('r.is_approved = false');
    if (trangThai === 'approved') qb.where('r.is_approved = true');

    const rows = await qb.getRawAndEntities();
    return rows.entities.map((e, i) => ({
      ...e,
      productName: rows.raw[i]?.product_name ?? null,
      productSlug: rows.raw[i]?.product_slug ?? null,
    }));
  }

  async update(id: string, dto: UpdateReviewDto): Promise<Review> {
    const review = await this.repo.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Không tìm thấy đánh giá');
    Object.assign(review, dto);
    const saved = await this.repo.save(review);
    await this.capNhatThongKe(saved.productId).catch(() => {});
    return saved;
  }

  async remove(id: string): Promise<void> {
    const review = await this.repo.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Không tìm thấy đánh giá');
    await this.repo.delete(id);
    await this.capNhatThongKe(review.productId).catch(() => {});
  }

  /** Số đánh giá đang chờ duyệt — để CMS hiện huy hiệu. */
  async demChoDuyet(): Promise<number> {
    return this.repo.count({ where: { isApproved: false } });
  }
}
