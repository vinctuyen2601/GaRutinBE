import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bảng kênh thông báo, và chuyển cấu hình email cũ sang thành một kênh.
 *
 * Trước đây trại chỉ có một đường báo đơn duy nhất: MailService đọc khoá
 * site_config `order_alert_email` rồi gửi qua Resend. Khoá đó không có ô nhập
 * trong CMS nên gần như không sửa được, và không có cách nào thêm Telegram hay
 * thêm người nhận thứ hai.
 *
 * Từ nay mọi kênh do chủ trại tự khai trong CMS. Nhưng nếu địa chỉ cũ đang có
 * giá trị thì phải mang sang, nếu không thì ngay sau lần triển khai này trại
 * lặng lẽ ngừng nhận báo đơn — kiểu hỏng không ai phát hiện cho tới lúc mất
 * một đơn thật.
 */
export class CreateNotificationChannels1800000000014 implements MigrationInterface {
  name = 'CreateNotificationChannels1800000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_channels (
        id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(255) NOT NULL,
        type        VARCHAR(50)  NOT NULL,
        config      JSONB        NOT NULL DEFAULT '{}',
        events      TEXT[]       NOT NULL DEFAULT '{}',
        is_active   BOOLEAN      NOT NULL DEFAULT true,
        created_at  TIMESTAMP    NOT NULL DEFAULT now(),
        updated_at  TIMESTAMP    NOT NULL DEFAULT now()
      )
    `);

    // Chỉ chuyển khi khoá cũ thật sự có địa chỉ. Migration 009 gieo sẵn chuỗi
    // rỗng, nên phải loại cả chuỗi rỗng lẫn chuỗi chỉ có khoảng trắng.
    await queryRunner.query(`
      INSERT INTO notification_channels (name, type, config, events, is_active)
      SELECT 'Email cảnh báo đơn (chuyển từ Cài đặt)',
             'email',
             jsonb_build_object('to', BTRIM("value")),
             ARRAY['order.created'],
             true
        FROM "site_config"
       WHERE "key" = 'order_alert_email'
         AND BTRIM(COALESCE("value", '')) <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notification_channels`);
  }
}
