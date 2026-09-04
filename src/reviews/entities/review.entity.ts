import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('reviews')
@Index('uq_reviews_product_ip', ['productId', 'ip'], { unique: true, where: '"ip" IS NOT NULL' })
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ name: 'customer_name' })
  customerName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'smallint', default: 5 })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  /** Tối đa 3 ảnh, kiểm ở DTO. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  images: string[];

  /** Một video, hoặc rỗng. */
  @Column({ type: 'text', nullable: true })
  video: string;

  @Column({ name: 'is_approved', default: false })
  isApproved: boolean;

  /**
   * IP người gửi, dùng để chặn gửi trùng. NULL khi không xác định được — lúc
   * đó không chặn, xem ghi chú ở migration 1800000000015.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt: Date;
}
