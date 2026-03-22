import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialGaRutinSchema1800000000000 implements MigrationInterface {
  name = 'InitialGaRutinSchema1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL UNIQUE,
        "password_hash" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT 'staff' CHECK ("role" IN ('admin', 'staff')),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "site_config" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" varchar NOT NULL UNIQUE,
        "value" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "slug" varchar NOT NULL UNIQUE,
        "description" text,
        "image_url" varchar,
        "sort_order" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "slug" varchar NOT NULL UNIQUE,
        "description" text,
        "price" decimal(12,2) NOT NULL DEFAULT 0,
        "sale_price" decimal(12,2),
        "images" jsonb NOT NULL DEFAULT '[]',
        "category_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
        "weight_per_unit" varchar,
        "unit" varchar NOT NULL DEFAULT 'con',
        "stock_status" varchar NOT NULL DEFAULT 'in_stock' CHECK ("stock_status" IN ('in_stock', 'out_of_stock', 'pre_order')),
        "is_featured" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" int NOT NULL DEFAULT 0,
        "seo_title" varchar,
        "seo_description" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "posts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar NOT NULL,
        "slug" varchar NOT NULL UNIQUE,
        "content" text,
        "excerpt" text,
        "cover_image" varchar,
        "category" varchar,
        "tags" jsonb NOT NULL DEFAULT '[]',
        "status" varchar NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'published', 'archived')),
        "published_at" timestamptz,
        "seo_title" varchar,
        "seo_description" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_number" varchar NOT NULL UNIQUE,
        "customer_name" varchar NOT NULL,
        "customer_phone" varchar NOT NULL,
        "customer_address" text,
        "items" jsonb NOT NULL DEFAULT '[]',
        "total_amount" decimal(12,2) NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'confirmed', 'shipping', 'delivered', 'cancelled')),
        "notes" text,
        "source" varchar NOT NULL DEFAULT 'web' CHECK ("source" IN ('web', 'zalo', 'phone', 'other')),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Seed default site config
    await queryRunner.query(`
      INSERT INTO "site_config" ("key", "value") VALUES
        ('site_name', 'GaRutin'),
        ('site_description', 'Trang trại gà rutin thuần chủng - Giao hàng toàn quốc'),
        ('phone', '0901234567'),
        ('zalo', '0901234567'),
        ('address', 'Việt Nam'),
        ('facebook', ''),
        ('tiktok', '')
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "posts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "site_config"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
