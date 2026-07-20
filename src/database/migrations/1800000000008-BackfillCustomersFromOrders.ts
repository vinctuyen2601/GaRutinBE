import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillCustomersFromOrders1800000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH latest_info AS (
        SELECT DISTINCT ON (customer_phone)
          customer_phone, customer_name, customer_address
        FROM "orders"
        WHERE customer_phone IS NOT NULL AND customer_phone != ''
        ORDER BY customer_phone, created_at DESC
      ),
      first_order AS (
        SELECT customer_phone, MIN(created_at) AS first_at
        FROM "orders"
        WHERE customer_phone IS NOT NULL AND customer_phone != ''
        GROUP BY customer_phone
      )
      INSERT INTO "customers" ("phone", "name", "address", "created_at", "updated_at")
      SELECT li.customer_phone, li.customer_name, li.customer_address, fo.first_at, fo.first_at
      FROM latest_info li
      JOIN first_order fo ON fo.customer_phone = li.customer_phone
      ON CONFLICT ("phone") DO NOTHING
    `);
  }

  public async down(): Promise<void> {
    // Không đảo ngược — không thể phân biệt khách hàng do backfill tạo ra
    // với khách hàng được tạo/sửa thủ công sau đó.
  }
}
