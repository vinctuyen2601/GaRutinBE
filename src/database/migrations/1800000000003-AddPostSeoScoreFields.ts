import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostSeoScoreFields1800000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "posts"
        ADD COLUMN IF NOT EXISTS "seo_score" integer,
        ADD COLUMN IF NOT EXISTS "content_score" integer,
        ADD COLUMN IF NOT EXISTS "seo_details" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "posts"
        DROP COLUMN IF EXISTS "seo_score",
        DROP COLUMN IF EXISTS "content_score",
        DROP COLUMN IF EXISTS "seo_details"
    `);
  }
}
