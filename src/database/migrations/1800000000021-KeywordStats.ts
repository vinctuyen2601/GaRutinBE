import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Biến bảng keywords từ "danh sách để đi cào bài" thành "bảng ra quyết định".
 *
 * Trước đây mỗi từ khoá chỉ có `crawl_count` và `last_crawled_at` — toàn số đo
 * về việc MÌNH đã làm, không có gì về THỊ TRƯỜNG. Hệ quả thấy rõ trong dữ liệu:
 * từ khoá "bao lâu thì đẻ trứng" bị cào 4 lần sinh ra hai bài trùng nhau, cả
 * hai 0 người đọc; trong khi "Chuồng gà rutin" — chủ đề mạnh nhất của shop —
 * nằm im chưa dùng lần nào. Không có số liệu thì thứ tự ưu tiên là cảm tính.
 *
 * Bốn cột mới lấy từ Search Console, tức số liệu THẬT của chính website này,
 * không phải ước lượng của công cụ bên thứ ba.
 *
 * `nguon` phân biệt từ khoá tự gõ, nhập từ Search Console, và gợi ý lấy từ
 * Google — để biết cái nào là nhu cầu đã kiểm chứng, cái nào mới là phỏng đoán.
 */
export class KeywordStats1800000000021 implements MigrationInterface {
  name = 'KeywordStats1800000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "keywords"
        ADD COLUMN IF NOT EXISTS "impressions"    int,
        ADD COLUMN IF NOT EXISTS "clicks"         int,
        ADD COLUMN IF NOT EXISTS "position"       numeric(5,1),
        ADD COLUMN IF NOT EXISTS "stats_at"       timestamptz,
        ADD COLUMN IF NOT EXISTS "nguon"          varchar NOT NULL DEFAULT 'tay',
        ADD COLUMN IF NOT EXISTS "ghi_chu"        text
    `);

    // Từ khoá gợi ý lấy từ Google, chưa được nhận vào danh sách chính.
    // Tách bảng riêng để danh sách làm việc không bị vài chục gợi ý làm loãng.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "keyword_suggestions" (
        "id"         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "keyword"    varchar NOT NULL UNIQUE,
        "tu_khoa_goc" varchar,
        "loai"       varchar NOT NULL DEFAULT 'lien-quan',
        "da_bo_qua"  boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "keyword_suggestions"`);
    await queryRunner.query(`
      ALTER TABLE "keywords"
        DROP COLUMN IF EXISTS "ghi_chu",
        DROP COLUMN IF EXISTS "nguon",
        DROP COLUMN IF EXISTS "stats_at",
        DROP COLUMN IF EXISTS "position",
        DROP COLUMN IF EXISTS "clicks",
        DROP COLUMN IF EXISTS "impressions"
    `);
  }
}
