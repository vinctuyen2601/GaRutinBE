import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thêm referrer và bộ UTM vào page_visits.
 *
 * Trước đây chỉ có cột `platform`, và nó bị ép về danh sách cố định
 * (facebook | youtube | tiktok | zalo | web | other). Hệ quả:
 *
 * - Chạy ba chiến dịch Facebook cùng lúc thì cả ba đều là 'facebook', không
 *   biết chiến dịch nào ra đơn — tức là không thể biết nên tắt cái nào.
 * - Khách từ Google, từ gõ thẳng địa chỉ, từ link người khác chia sẻ đều rơi
 *   hết vào 'web'.
 *
 * utm_source giữ nguyên giá trị thô, khác với `platform` đã bị chuẩn hoá, để
 * sau này xuất hiện nguồn mới thì dữ liệu cũ vẫn còn nguyên.
 *
 * Cùng cấu trúc với 17fishing (migration 1800000000039) để hai shop đọc số
 * liệu theo cùng một cách.
 */
export class AddUtmToPageVisits1800000000018 implements MigrationInterface {
  name = 'AddUtmToPageVisits1800000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "page_visits"
        ADD COLUMN IF NOT EXISTS "referrer" text,
        ADD COLUMN IF NOT EXISTS "referrer_host" varchar,
        ADD COLUMN IF NOT EXISTS "utm_source" varchar,
        ADD COLUMN IF NOT EXISTS "utm_medium" varchar,
        ADD COLUMN IF NOT EXISTS "utm_campaign" varchar,
        ADD COLUMN IF NOT EXISTS "utm_content" varchar
    `);

    // Báo cáo luôn gom theo hai cột này nên đánh index sẵn.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_page_visits_referrer_host"
        ON "page_visits" ("referrer_host")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_page_visits_utm_campaign"
        ON "page_visits" ("utm_campaign")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_page_visits_utm_campaign"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_page_visits_referrer_host"`);
    await queryRunner.query(`
      ALTER TABLE "page_visits"
        DROP COLUMN IF EXISTS "utm_content",
        DROP COLUMN IF EXISTS "utm_campaign",
        DROP COLUMN IF EXISTS "utm_medium",
        DROP COLUMN IF EXISTS "utm_source",
        DROP COLUMN IF EXISTS "referrer_host",
        DROP COLUMN IF EXISTS "referrer"
    `);
  }
}
