import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cho phép chuyển hướng một bài viết sang bài khác.
 *
 * Dùng khi gộp bài trùng. Đây là khác biệt giữa "gộp" và "xoá": chuyển hướng
 * 301 dồn mọi tín hiệu mà trang cũ đã tích luỹ về trang mới, còn xoá thì vứt
 * đi và để lại 404 cho mọi ai đã lưu hoặc đã dẫn link tới đó.
 *
 * Trường hợp thật đang cần: 21 bài "Mua Gà Rutin [quận] Ở Đâu?" gần giống hệt
 * nhau — một bài TP HCM có 115 người đọc, 20 bài theo quận có tổng 22 người và
 * không truy vấn cấp quận nào xuất hiện trong Search Console suốt 90 ngày.
 *
 * Lưu SLUG chứ không phải id: slug đọc được, và nếu bài đích bị xoá thì thấy
 * ngay slug hỏng thay vì một uuid vô nghĩa.
 */
export class AddRedirectToPosts1800000000022 implements MigrationInterface {
  name = 'AddRedirectToPosts1800000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "posts"
        ADD COLUMN IF NOT EXISTS "redirect_to" varchar
    `);
    // Danh sách bài và sitemap đều phải loại bài đã chuyển hướng, nên lọc theo
    // cột này là truy vấn thường xuyên.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_posts_redirect_to"
        ON "posts" ("redirect_to") WHERE "redirect_to" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_posts_redirect_to"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "redirect_to"`);
  }
}
