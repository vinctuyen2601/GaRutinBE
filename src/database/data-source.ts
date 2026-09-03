import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../users/entities/user.entity';
import { SiteConfig } from '../site-config/entities/site-config.entity';
import { Category } from '../categories/entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { Post } from '../posts/entities/post.entity';
import { Order } from '../orders/entities/order.entity';
import { MediaFile } from '../media/entities/media-file.entity';
import { GalleryItem } from '../gallery/entities/gallery-item.entity';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  /**
   * Nhận cả hai cách khai, giống hệt app.module.ts.
   *
   * Bản cũ chỉ đọc DATABASE_URL. Máy chủ thật có biến đó nên chạy được, nhưng
   * ai chạy migration ở máy với DB_HOST/DB_PORT rời sẽ nhận lỗi
   * "client password must be a string" — chẳng gợi ý gì tới nguyên nhân thật
   * là thiếu biến. Hai tệp cấu hình cùng đọc một nguồn thì không lệch được.
   */
  ...(process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'garutin',
      }),
  entities: [User, SiteConfig, Category, Product, Post, Order, MediaFile, GalleryItem],
  /**
   * Đường dẫn tính từ vị trí tệp này, không phải từ thư mục đang đứng.
   *
   * Bản cũ ghi 'src/database/migrations/*.ts' — đường dẫn tương đối, chỉ đúng
   * khi gõ lệnh ở gốc dự án và chỉ tìm thấy tệp .ts. Chạy từ bản đã biên dịch
   * (dist/database/data-source.js) thì không thấy migration nào, và lệnh báo
   * "no migrations are pending" trong khi thật ra chưa chạy cái nào.
   */
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsTransactionMode: 'each',
  synchronize: false,
  logging: true,
});
