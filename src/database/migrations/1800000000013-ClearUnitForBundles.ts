import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bỏ đơn vị "con" khỏi các sản phẩm bán trọn gói (combo).
 *
 * Cột `unit` có `default: 'con'`, nên mọi sản phẩm tạo trong CMS mà không sửa
 * ô "Đơn vị" đều thành 'con' — kể cả combo. Trên production việc đó tạo ra
 * dòng giá đọc là:
 *
 *     "Combo 5 cặp gà rutin trống mái — 500.000 đ /con"
 *
 * Trong khi 500.000đ là giá của cả combo mười con. Khách hiểu thành 500 nghìn
 * MỘT CON, tức 5 triệu cho cả combo. Kiểu hiểu nhầm này khách không nhắn hỏi
 * lại, chỉ lặng lẽ đóng trang — nên nó không bao giờ hiện ra ở đâu cả.
 *
 * Để trống thay vì đổi thành 'combo'/'bộ': giá của combo là giá trọn gói, nó
 * không quy về đơn vị nào hết. Bên web đã có `hauToDonVi()` để không hiện dấu
 * "/" cụt khi trường này rỗng.
 *
 * Nhận diện bằng tên bắt đầu bằng "combo" — đúng cách ba sản phẩm hiện có được
 * đặt tên. Đây là một lần sửa dữ liệu hỏng đã biết, không phải quy tắc lâu
 * dài: về sau chủ trại đặt đơn vị ngay trong CMS lúc tạo sản phẩm.
 */
export class ClearUnitForBundles1800000000013 implements MigrationInterface {
  name = 'ClearUnitForBundles1800000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "products"
         SET "unit" = ''
       WHERE "name" ILIKE 'combo%'
         AND "unit" <> ''
    `);
  }

  /**
   * Không đặt lại 'con' — đó là giá trị sai, không phải giá trị cũ đáng giữ.
   */
  public async down(): Promise<void> {
    // cố ý để trống
  }
}
