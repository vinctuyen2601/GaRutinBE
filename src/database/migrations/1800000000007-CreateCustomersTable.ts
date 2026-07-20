import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomersTable1800000000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "phone" varchar NOT NULL,
        "name" varchar,
        "address" varchar,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "UQ_customers_phone" UNIQUE ("phone"),
        CONSTRAINT "PK_customers_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_customers_phone" ON "customers" ("phone")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "customers"`);
  }
}
