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

  /* ── Số liệu thị trường, nhập từ Search Console ────────────────────────── */

  /** Số lần Google đưa website ra trước mặt người tìm từ khoá này. */
  @Column({ type: 'int', nullable: true })
  impressions: number | null;

  @Column({ type: 'int', nullable: true })
  clicks: number | null;

  /** Vị trí trung bình. numeric vì Search Console trả về số lẻ (4.7). */
  @Column({ type: 'numeric', precision: 5, scale: 1, nullable: true })
  position: string | null;

  @Column({ name: 'stats_at', type: 'timestamptz', nullable: true })
  statsAt: Date | null;

  /** tay | search-console | goi-y — để biết đâu là nhu cầu đã kiểm chứng. */
  @Column({ default: 'tay' })
  nguon: string;

  @Column({ name: 'ghi_chu', type: 'text', nullable: true })
  ghiChu: string | null;

  /* ── Di sản của chức năng cào bài cũ, giữ lại để không mất dữ liệu ─────── */

  @Column({ name: 'crawl_count', type: 'int', default: 0 })
  crawlCount: number;

  @Column({ name: 'last_crawled_at', nullable: true, type: 'timestamptz' })
  lastCrawledAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
