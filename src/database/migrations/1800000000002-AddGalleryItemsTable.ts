import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGalleryItemsTable1800000000002 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gallery_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL DEFAULT 'image',
        url TEXT NOT NULL,
        thumbnail TEXT,
        caption TEXT,
        source TEXT NOT NULL DEFAULT 'admin',
        customer_name TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_gallery_items_active_sort
        ON gallery_items (is_active, sort_order ASC, created_at DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS gallery_items`);
  }
}
