import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaFile } from './entities/media-file.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([MediaFile]), StorageModule],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
