import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Đánh dấu từ khoá không liên quan để nó thôi làm rối bảng.
 *
 * Vì sao ĐÁNH DẤU chứ không XOÁ: đồng bộ Search Console nhập lại toàn bộ truy
 * vấn mỗi lần chạy, nên xoá xong lần đồng bộ sau nó quay lại nguyên vẹn. Xoá ở
 * đây là việc vô ích lặp đi lặp lại.
 *
 * Trường hợp thật đang cần: "pet adoption near me" — 1.478 lượt hiển thị, vị
 * trí 1,4, truy vấn tiếng Anh về nhận nuôi thú cưng, không liên quan gì tới bán
 * gà cảnh ở Việt Nam. Nó đứng đầu bảng và làm mọi con số trung bình bị méo.
 */
export class KeywordBoQua1800000000023 implements MigrationInterface {
  name = 'KeywordBoQua1800000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "keywords"
        ADD COLUMN IF NOT EXISTS "da_bo_qua" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "ly_do_bo_qua" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "keywords"
        DROP COLUMN IF EXISTS "ly_do_bo_qua",
        DROP COLUMN IF EXISTS "da_bo_qua"
    `);
  }
}
