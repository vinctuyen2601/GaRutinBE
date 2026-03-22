import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StorageModule } from './storage/storage.module';
import { SiteConfigModule } from './site-config/site-config.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { PostsModule } from './posts/posts.module';
import { OrdersModule } from './orders/orders.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      ...(process.env.DATABASE_URL
        ? { url: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: process.env.DB_NAME || 'garutin',
          }),
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
      poolSize: process.env.NODE_ENV === 'production' ? 4 : 10,
      connectTimeoutMS: 10000,
    }),
    AuthModule,
    UsersModule,
    StorageModule,
    SiteConfigModule,
    CategoriesModule,
    ProductsModule,
    PostsModule,
    OrdersModule,
    MediaModule,
  ],
})
export class AppModule {}
