import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Một sản phẩm có nhiều video, thay vì đúng một.
 *
 * Trại quay được nhiều clip cho cùng một lứa — đàn đang ăn, cận cảnh con
 * giống, đóng gói — mà cột video_url chỉ chứa được một.
 *
 * Vì sao KHÔNG nhét video vào luôn mảng images cho gọn: có 13 chỗ đang đọc
 * products.images và tất cả đều giả định đó là ảnh. Nặng nhất là feed Google
 * Merchant (products.controller.ts, thẻ <g:image_link>) — một URL video lọt
 * vào đó là Google từ chối sản phẩm, mất hẳn một kênh bán. Kế đến là JSON-LD
 * và ảnh chia sẻ Open Graph. Tách riêng thì không chỗ nào phải sửa.
 *
 * video_url bị xoá, nhưng DTO vẫn nhận trường đó thêm một thời gian: CMS trên
 * Vercel deploy tách khỏi máy chủ, nên có vài phút CMS cũ nói chuyện với API
 * mới, và nếu API từ chối videoUrl thì chủ trại không lưu được sản phẩm.
 */
export class AddProductVideos1800000000012 implements MigrationInterface {
  name = 'AddProductVideos1800000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "videos" jsonb NOT NULL DEFAULT '[]'
    `);

    // Chuyển giá trị cũ sang, chỉ khi videos còn rỗng — để chạy lại migration
    // không ghi đè thứ người dùng đã nhập trong lúc đó.
    await queryRunner.query(`
      UPDATE "products"
         SET "videos" = jsonb_build_array("video_url")
       WHERE "video_url" IS NOT NULL
         AND "video_url" <> ''
         AND "videos" = '[]'::jsonb
    `);

    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "video_url"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "video_url" varchar
    `);
    // Chỉ lấy lại được video đầu tiên — cột cũ vốn chỉ chứa một.
    await queryRunner.query(`
      UPDATE "products"
         SET "video_url" = "videos"->>0
       WHERE jsonb_array_length("videos") > 0
    `);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "videos"`);
  }
}
