import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Một prompt đã bị người dùng sửa.
 *
 * Khoá chính là `key` chứ không phải id tự sinh: mỗi prompt trong hệ thống có
 * đúng một bản ghi đè, và tra theo khoá là thao tác duy nhất cần làm.
 */
@Entity('ai_prompts')
export class AiPrompt {
  @PrimaryColumn()
  key: string;

  @Column({ type: 'text' })
  content: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
