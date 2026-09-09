import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Keyword } from './entities/keyword.entity';
import { KeywordSuggestion } from './entities/keyword-suggestion.entity';
import { Post } from '../posts/entities/post.entity';
import { KeywordsService } from './keywords.service';
import { TroLyService } from './tro-ly.service';
import { KeywordsController } from './keywords.controller';
import { TrackingModule } from '../tracking/tracking.module';
import { SearchService } from '../posts/search.service';
import { SearchConsoleService } from './search-console.service';
import { GoiYService } from './goi-y.service';
import { AiPromptsModule } from '../ai-prompts/ai-prompts.module';

@Module({
  // Post và TrackingModule ở đây vì trợ lý phải ghép từ khoá với bài viết và
  // số người đọc thật — không có hai nguồn đó thì bảng chỉ còn là danh sách gõ tay.
  imports: [
    TypeOrmModule.forFeature([Keyword, KeywordSuggestion, Post]),
    TrackingModule,
    // Prompt soạn phần bổ sung sửa được từ CMS như mọi prompt khác.
    AiPromptsModule,
  ],
  providers: [KeywordsService, TroLyService, SearchService, SearchConsoleService, GoiYService],
  controllers: [KeywordsController],
  exports: [KeywordsService],
})
export class KeywordsModule {}
