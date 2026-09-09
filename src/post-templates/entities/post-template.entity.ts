import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Một cấu trúc bài viết.
 *
 * Khoá chính là chuỗi `id` do người dùng đặt (vd "how-to"), không phải uuid:
 * id này được LƯU VÀO BÀI VIẾT (posts.template_id) và đi vào prompt, nên nó
 * cần đọc được và ổn định. Đổi id là bài cũ mất khuôn.
 */
@Entity('post_templates')
export class PostTemplateEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ default: '' })
  description: string;

  /** Nội dung gửi cho AI — thay thế ba quy tắc mặc định về FAQ, CTA, internal link. */
  @Column({ type: 'text' })
  brief: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  /**
   * Tắt thay vì xoá cho những khuôn đã có bài dùng.
   *
   * Xoá hẳn thì bài cũ trỏ tới một id không còn tồn tại: danh sách bài hiện id
   * trần thay vì tên khuôn, và prompt cải thiện lặng lẽ rơi về ba quy tắc mặc
   * định — bài đó bị viết lại theo khuôn khác mà không ai biết.
   */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** Khuôn dựng sẵn theo hệ thống — có nút khôi phục về bản gốc. */
  @Column({ name: 'is_builtin', default: false })
  isBuiltin: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
