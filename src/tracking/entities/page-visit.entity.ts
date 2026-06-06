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

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
