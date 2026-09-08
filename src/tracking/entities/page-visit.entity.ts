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

  /** URL đầy đủ nơi khách bấm sang, chỉ ghi khi đến từ tên miền khác. */
  @Column({ type: 'text', nullable: true })
  referrer: string | null;

  /** Chỉ phần tên miền của referrer, để gom nhóm mà không phải cắt chuỗi khi truy vấn. */
  @Column({ name: 'referrer_host', nullable: true })
  referrerHost: string | null;

  /**
   * Bộ UTM lấy nguyên văn từ link quảng cáo.
   *
   * Giữ giá trị THÔ, không ép về danh sách như `platform`: `platform` trả lời
   * "kênh nào", còn utm_campaign trả lời "chiến dịch nào" — chạy ba quảng cáo
   * Facebook cùng lúc thì chỉ utm_campaign mới tách được chúng ra.
   */
  @Column({ name: 'utm_source', nullable: true })
  utmSource: string | null;

  @Column({ name: 'utm_medium', nullable: true })
  utmMedium: string | null;

  @Column({ name: 'utm_campaign', nullable: true })
  utmCampaign: string | null;

  @Column({ name: 'utm_content', nullable: true })
  utmContent: string | null;

  @Column({ name: 'is_bot', default: false })
  isBot: boolean;

  @Column({ name: 'user_agent', nullable: true })
  userAgent: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
