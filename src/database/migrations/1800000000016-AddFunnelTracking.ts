import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bổ sung dữ liệu cần cho bảng phễu "xem → thêm giỏ → vào đặt hàng → mua".
 *
 * Trước đây page_visits chỉ ghi ĐƯỜNG DẪN: biết trang nào được xem bao nhiêu
 * lượt, nhưng không biết ai xem, cũng không biết họ có bấm thêm giỏ hay không.
 * Phễu cần cả ba thứ:
 *
 * - `event`: bước nào trong phễu (view / add_to_cart / begin_checkout).
 * - `visitor_id`: để đếm SỐ NGƯỜI chứ không phải số lượt. Một người mở lại
 *   trang sản phẩm năm lần không phải là năm người quan tâm.
 * - `is_bot`: bot đọc trang sản phẩm rất nhiều nhưng không bao giờ thêm giỏ,
 *   để lẫn vào thì mọi sản phẩm đều trông như "xem nhiều, mua ít".
 *
 * orders thêm `visitor_id` để nối đơn hàng với người đã xem — không có nó thì
 * cột "người mua" chỉ đếm được đơn, không biết bao nhiêu người.
 *
 * Lưu ý: dữ liệu cũ không có mấy trường này, nên bảng phễu chỉ có số liệu tính
 * từ lúc triển khai trở đi. Lượt truy cập cũ mặc định event='view' để phần
 * thống kê sẵn có không đổi ý nghĩa.
 */
export class AddFunnelTracking1800000000016 implements MigrationInterface {
  name = 'AddFunnelTracking1800000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "page_visits"
        ADD COLUMN IF NOT EXISTS "event"      VARCHAR(32) NOT NULL DEFAULT 'view',
        ADD COLUMN IF NOT EXISTS "visitor_id" VARCHAR(64),
        ADD COLUMN IF NOT EXISTS "is_bot"     BOOLEAN     NOT NULL DEFAULT false
    `);

    // Truy vấn phễu luôn lọc theo event và gom theo đường dẫn sản phẩm.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_page_visits_event_path"
        ON "page_visits" ("event", "path")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_page_visits_visitor"
        ON "page_visits" ("visitor_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "visitor_id" VARCHAR(64)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "visitor_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_page_visits_visitor"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_page_visits_event_path"`);
    await queryRunner.query(`
      ALTER TABLE "page_visits"
        DROP COLUMN IF EXISTS "is_bot",
        DROP COLUMN IF EXISTS "visitor_id",
        DROP COLUMN IF EXISTS "event"
    `);
  }
}
