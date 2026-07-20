import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPageVisitsTable1800000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "page_visits" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "platform" varchar NOT NULL DEFAULT 'web',
        "path" varchar NOT NULL,
        "ip" varchar,
        "user_agent" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_page_visits_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_page_visits_created_at" ON "page_visits" ("created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_page_visits_path" ON "page_visits" ("path")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "page_visits"`);
  }
}
