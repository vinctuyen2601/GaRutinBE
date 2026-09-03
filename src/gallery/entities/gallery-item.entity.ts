import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('gallery_items')
export class GalleryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'image' })
  type: 'image' | 'video';

  @Column()
  url: string;

  @Column({ nullable: true })
  thumbnail: string;

  @Column({ nullable: true })
  caption: string;

  @Column({ default: 'admin' })
  source: 'admin' | 'customer';

  @Column({ name: 'customer_name', nullable: true })
  customerName: string;

  /**
   * Ngày QUAY, không phải ngày đăng.
   *
   * Video trang trại mất giá trị rất nhanh — khách nhìn "quay năm ngoái" là
   * nghi đàn đã bán hết. created_at không thay được: có clip quay hôm nay mà
   * tuần sau mới đăng.
   */
  @Column({ name: 'filmed_at', type: 'date', nullable: true })
  filmedAt: string | null;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
