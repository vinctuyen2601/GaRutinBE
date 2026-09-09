import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostTemplateEntity } from './entities/post-template.entity';
import { PostTemplatesService } from './post-templates.service';
import { PostTemplatesController } from './post-templates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PostTemplateEntity])],
  controllers: [PostTemplatesController],
  providers: [PostTemplatesService],
  exports: [PostTemplatesService],
})
export class PostTemplatesModule {}
