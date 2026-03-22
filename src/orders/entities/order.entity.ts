import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type OrderItem = {
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  unit: string;
};

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_number', unique: true })
  orderNumber: string;

  @Column({ name: 'customer_name' })
  customerName: string;

  @Column({ name: 'customer_phone' })
  customerPhone: string;

  @Column({ name: 'customer_address', nullable: true })
  customerAddress: string;

  @Column({ type: 'jsonb', default: [] })
  items: OrderItem[];

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ default: 'pending' })
  status: 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled';

  @Column({ nullable: true })
  notes: string;

  @Column({ default: 'web' })
  source: 'web' | 'zalo' | 'phone' | 'other';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
