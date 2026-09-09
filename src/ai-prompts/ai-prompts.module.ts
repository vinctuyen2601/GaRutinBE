import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiPrompt } from './entities/ai-prompt.entity';
import { AiPromptsService } from './ai-prompts.service';
import { AiPromptsController } from './ai-prompts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AiPrompt])],
  controllers: [AiPromptsController],
  providers: [AiPromptsService],
  // PostsModule cần service này để lấy prompt lúc gọi LLM.
  exports: [AiPromptsService],
})
export class AiPromptsModule {}
