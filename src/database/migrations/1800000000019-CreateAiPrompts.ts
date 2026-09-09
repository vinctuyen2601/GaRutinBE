import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bảng ghi đè prompt AI.
 *
 * CHỈ lưu bản đã sửa. Không có bản ghi cho một khoá thì hệ thống dùng prompt
 * mặc định nằm trong mã nguồn (`src/ai-prompts/registry.ts`).
 *
 * Thiết kế như vậy để prompt gốc không bao giờ mất: sửa hỏng thì xoá bản ghi đè
 * là quay về nguyên trạng, không cần nhớ nội dung cũ. Nếu lưu cả bản mặc định
 * vào CSDL thì một lần sửa sai là mất luôn bản gốc, và nâng cấp mã sau này cũng
 * không cập nhật được prompt cho những shop đã lỡ lưu.
 */
export class CreateAiPrompts1800000000019 implements MigrationInterface {
  name = 'CreateAiPrompts1800000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_prompts" (
        "key"        varchar PRIMARY KEY,
        "content"    text NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_prompts"`);
  }
}
