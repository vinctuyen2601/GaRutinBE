import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

/**
 * Một từ khoá Google gợi ý, chưa được nhận vào danh sách làm việc.
 *
 * Tách khỏi bảng `keywords` để danh sách chính không bị vài chục gợi ý làm
 * loãng — danh sách chính là nơi ra quyết định, gợi ý là nguyên liệu thô.
 */
@Entity('keyword_suggestions')
export class KeywordSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  keyword: string;

  /** Từ khoá nào sinh ra gợi ý này. */
  @Column({ name: 'tu_khoa_goc', nullable: true })
  tuKhoaGoc: string | null;

  /** lien-quan (relatedSearches) | cau-hoi (peopleAlsoAsk) */
  @Column({ default: 'lien-quan' })
  loai: string;

  /** Đã xem và quyết định không dùng — để lần sau không gợi ý lại. */
  @Column({ name: 'da_bo_qua', default: false })
  daBoQua: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
