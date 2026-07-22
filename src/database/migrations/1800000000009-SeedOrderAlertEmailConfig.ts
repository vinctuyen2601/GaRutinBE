import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedOrderAlertEmailConfig1800000000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "site_config" ("key", "value") VALUES
        ('order_alert_email', '')
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "site_config" WHERE "key" = 'order_alert_email'`);
  }
}
