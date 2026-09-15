import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../posts/entities/post.entity';
import { CanhService } from './canh.service';
import { CanhController } from './canh.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { KeywordsModule } from '../keywords/keywords.module';

@Module({
  imports: [TypeOrmModule.forFeature([Post]), NotificationsModule, KeywordsModule],
  controllers: [CanhController],
  providers: [CanhService],
})
export class CanhModule {}
