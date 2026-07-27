import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPageVisitsCreatedAtTimezone1800000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // page_visits.created_at was created as plain TIMESTAMP (no timezone), unlike every
    // other created_at column in this schema (orders, products, posts... all TIMESTAMPTZ).
    // Values were written via DEFAULT now() under a UTC session, so they ARE UTC wall-clock
    // values — reinterpret them as UTC when converting so no data shifts.
    await queryRunner.query(`
      ALTER TABLE "page_visits"
      ALTER COLUMN "created_at" TYPE TIMESTAMPTZ
      USING "created_at" AT TIME ZONE 'UTC'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "page_visits"
      ALTER COLUMN "created_at" TYPE TIMESTAMP
      USING "created_at" AT TIME ZONE 'UTC'
    `);
  }
}
