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
  url: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  entities: [User, SiteConfig, Category, Product, Post, Order, MediaFile, GalleryItem],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTransactionMode: 'each',
  synchronize: false,
  logging: true,
});
