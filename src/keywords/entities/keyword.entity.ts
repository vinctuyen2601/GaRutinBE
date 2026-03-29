import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('keywords')
export class Keyword {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  keyword: string;

  @Column({ nullable: true })
  category: string;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  @Column({ name: 'crawl_count', type: 'int', default: 0 })
  crawlCount: number;

  @Column({ name: 'last_crawled_at', nullable: true, type: 'timestamptz' })
  lastCrawledAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
