import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { CrawlerService } from './crawler.service';
import { SearchService } from './search.service';
import { KeywordsModule } from '../keywords/keywords.module';

@Module({
  imports: [TypeOrmModule.forFeature([Post]), KeywordsModule],
  providers: [PostsService, CrawlerService, SearchService],
  controllers: [PostsController],
  exports: [PostsService],
})
export class PostsModule {}
