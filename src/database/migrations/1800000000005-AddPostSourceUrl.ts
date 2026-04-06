import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostSourceUrl1800000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "posts"
        ADD COLUMN IF NOT EXISTS "source_url" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "source_url"`);
  }
}
