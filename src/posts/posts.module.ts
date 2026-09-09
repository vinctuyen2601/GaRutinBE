import { Module } from '@nestjs/common';
import { PostTemplatesModule } from '../post-templates/post-templates.module';
import { AiPromptsModule } from '../ai-prompts/ai-prompts.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { CrawlerService } from './crawler.service';
import { SearchService } from './search.service';
import { KeywordsModule } from '../keywords/keywords.module';

@Module({
  imports: [AiPromptsModule, PostTemplatesModule, TypeOrmModule.forFeature([Post]), KeywordsModule],
  providers: [PostsService, CrawlerService, SearchService],
  controllers: [PostsController],
  exports: [PostsService],
})
export class PostsModule {}
