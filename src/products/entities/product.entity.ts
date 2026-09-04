import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price: number;

  @Column({ name: 'sale_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  salePrice: number;

  @Column({ type: 'jsonb', default: [] })
  images: string[];

  @Column({ name: 'category_id', nullable: true })
  categoryId: string;

  @Column({ name: 'weight_per_unit', nullable: true })
  weightPerUnit: string;

  @Column({ default: 'con' })
  unit: string;

  /** Điểm trung bình từ đánh giá ĐÃ DUYỆT. NULL khi chưa có đánh giá nào. */
  @Column({ name: 'avg_rating', type: 'decimal', precision: 3, scale: 2, nullable: true })
  avgRating: number | null;

  /** Số đánh giá đã duyệt. */
  @Column({ name: 'review_count', type: 'int', default: 0 })
  reviewCount: number;

  @Column({ name: 'stock_status', default: 'in_stock' })
  stockStatus: 'in_stock' | 'out_of_stock' | 'pre_order';

  @Column({ name: 'is_featured', default: false })
  isFeatured: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  /**
   * Video của lứa hàng đang bán. Mỗi phần tử là link YouTube hoặc đường dẫn
   * mp4 tự lưu — web tự phân biệt và hiển thị khác nhau.
   *
   * Tách khỏi `images` chứ không trộn chung: 13 chỗ đang đọc `images` đều giả
   * định đó là ảnh, nặng nhất là feed Google Merchant (<g:image_link>) — lọt
   * một URL video vào đó là Google từ chối sản phẩm. Xem migration 012.
   *
   * Thứ tự hiển thị: video trước rồi mới tới ảnh. Video là thứ giữ mắt khách
   * lại; để sau thì phần lớn không cuộn tới.
   */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  videos: string[];

  @Column({ name: 'seo_title', nullable: true })
  seoTitle: string;

  @Column({ name: 'seo_description', nullable: true })
  seoDescription: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
