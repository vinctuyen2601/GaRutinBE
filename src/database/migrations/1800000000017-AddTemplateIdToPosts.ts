import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lưu cấu trúc bài viết (template) vào chính bài viết.
 *
 * Trước đây `templateId` chỉ là trạng thái tạm của form: chọn xong thì truyền
 * cho các endpoint AI rồi mất hẳn khi tải lại trang. Hệ quả là không có cách
 * nào nhìn danh sách mà biết bài nào theo khuôn nào — mà đó lại đúng là thứ
 * cần thấy để tránh mọi bài ra cùng một khuôn.
 *
 * Không đặt khoá ngoại: danh sách khuôn nằm trong mã nguồn
 * (`src/posts/post-templates.ts`) chứ không phải trong CSDL. Bỏ một khuôn khỏi
 * mã thì bài cũ vẫn giữ nguyên chuỗi id, và chỗ hiển thị sẽ hiện lại chính
 * chuỗi đó — thà thấy một id lạ còn hơn mất dữ liệu.
 *
 * Bài cũ để NULL. Không đoán khuôn cho chúng: đoán sai còn tệ hơn để trống,
 * vì người dùng sẽ tin vào con số đó khi rà lại nội dung.
 */
export class AddTemplateIdToPosts1800000000017 implements MigrationInterface {
  name = 'AddTemplateIdToPosts1800000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "posts"
        ADD COLUMN IF NOT EXISTS "template_id" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "posts" DROP COLUMN IF EXISTS "template_id"
    `);
  }
}
