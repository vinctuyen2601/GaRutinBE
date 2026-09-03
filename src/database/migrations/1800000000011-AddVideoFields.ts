import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hai trường phục vụ video.
 *
 * gallery_items.filmed_at — ngày quay, do người đăng nhập vào chứ không lấy
 * created_at. Video trang trại mất giá trị rất nhanh: khách nhìn "quay tháng
 * trước" thì tin, nhìn "quay năm ngoái" thì nghi đàn đã bán hết. Ngày tải lên
 * không nói được điều đó — có clip quay hôm nay mà tuần sau mới đăng.
 *
 * products.video_url — video của chính lứa hàng đang bán, hiện ngay ở vị trí
 * ảnh chính. Nỗi lo "có đúng giống không, có khoẻ không" phát sinh ở trang chi
 * tiết sản phẩm nên phải trả lời tại đó, không phải ở gallery trang chủ.
 *
 * Nhận cả link YouTube lẫn đường dẫn tệp mp4 tự lưu; web tự phân biệt.
 */
export class AddVideoFields1800000000011 implements MigrationInterface {
  name = 'AddVideoFields1800000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "gallery_items" ADD COLUMN IF NOT EXISTS "filmed_at" date
    `);
    await queryRunner.query(`
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "video_url" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "video_url"`);
    await queryRunner.query(`ALTER TABLE "gallery_items" DROP COLUMN IF EXISTS "filmed_at"`);
  }
}
