import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKeywordsAndPostKeywordId1800000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tạo bảng keywords
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "keywords" (
        "id"              uuid              NOT NULL DEFAULT gen_random_uuid(),
        "keyword"         varchar           NOT NULL,
        "category"        varchar,
        "is_active"       boolean           NOT NULL DEFAULT false,
        "crawl_count"     integer           NOT NULL DEFAULT 0,
        "last_crawled_at" timestamptz,
        "created_at"      timestamptz       NOT NULL DEFAULT now(),
        "updated_at"      timestamptz       NOT NULL DEFAULT now(),
        CONSTRAINT "PK_keywords" PRIMARY KEY ("id")
      )
    `);

    // Thêm cột keyword_id vào posts
    await queryRunner.query(`
      ALTER TABLE "posts"
        ADD COLUMN IF NOT EXISTS "keyword_id" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "keyword_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "keywords"`);
  }
}
