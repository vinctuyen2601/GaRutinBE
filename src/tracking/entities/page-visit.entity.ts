import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export type Platform = 'facebook' | 'youtube' | 'tiktok' | 'zalo' | 'web' | 'other';

@Entity('page_visits')
export class PageVisit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'web' })
  platform: Platform;

  @Column()
  path: string;

  @Column({ nullable: true })
  ip: string;

  /** Bước trong phễu: view | add_to_cart | begin_checkout. */
  @Column({ default: 'view' })
  event: string;

  /** Mã người xem do trình duyệt sinh, để đếm số NGƯỜI thay vì số lượt. */
  @Column({ name: 'visitor_id', type: 'varchar', length: 64, nullable: true })
  visitorId: string | null;

  @Column({ name: 'is_bot', default: false })
  isBot: boolean;

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
