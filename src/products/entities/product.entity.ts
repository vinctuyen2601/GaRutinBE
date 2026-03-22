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

  @Column({ name: 'stock_status', default: 'in_stock' })
  stockStatus: 'in_stock' | 'out_of_stock' | 'pre_order';

  @Column({ name: 'is_featured', default: false })
  isFeatured: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

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
