import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bảng đánh giá sản phẩm, và hai cột thống kê trên products.
 *
 * Khách gửi đánh giá KHÔNG cần đăng nhập, nên chống spam bằng IP: mỗi IP chỉ
 * gửi được một đánh giá cho mỗi sản phẩm. Ràng buộc đặt ở chỉ mục duy nhất chứ
 * không chỉ kiểm trong mã: hai yêu cầu gửi cùng lúc thì phép kiểm "đã có chưa"
 * ở tầng ứng dụng đọc trước khi cái kia ghi xong, và cả hai đều lọt.
 *
 * Điều kiện `WHERE ip IS NOT NULL` là có chủ ý. Khi không xác định được IP
 * khách (thiếu header, đổi hạ tầng), ứng dụng ghi NULL và KHÔNG chặn. Chọn cho
 * lọt hơn là chặn nhầm: đánh giá spam vẫn phải qua bước duyệt của chủ trại nên
 * không lên web, còn chặn nhầm thì mọi khách sau người đầu tiên đều bị từ chối
 * mà không ai biết vì sao.
 */
export class CreateReviews1800000000015 implements MigrationInterface {
  name = 'CreateReviews1800000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reviews" (
        "id"            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "product_id"    UUID        NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "customer_name" VARCHAR(120) NOT NULL,
        "phone"         VARCHAR(30),
        "rating"        SMALLINT    NOT NULL DEFAULT 5,
        "comment"       TEXT,
        "images"        JSONB       NOT NULL DEFAULT '[]',
        "video"         TEXT,
        "is_approved"   BOOLEAN     NOT NULL DEFAULT false,
        "ip"            VARCHAR(64),
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Truy vấn công khai luôn là "đánh giá đã duyệt của sản phẩm này".
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_reviews_product_approved"
        ON "reviews" ("product_id", "is_approved")
    `);

    // Một IP một đánh giá cho mỗi sản phẩm.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_reviews_product_ip"
        ON "reviews" ("product_id", "ip") WHERE "ip" IS NOT NULL
    `);

    // Thống kê để trang sản phẩm và thẻ sản phẩm khỏi phải đếm lại mỗi lần.
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "avg_rating"   NUMERIC(3,2),
        ADD COLUMN IF NOT EXISTS "review_count" INTEGER NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "review_count"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "avg_rating"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reviews"`);
  }
}
