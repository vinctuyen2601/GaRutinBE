import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteConfig } from './entities/site-config.entity';
import { SiteConfigService } from './site-config.service';
import { SiteConfigController } from './site-config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SiteConfig])],
  providers: [SiteConfigService],
  controllers: [SiteConfigController],
  exports: [SiteConfigService],
})
export class SiteConfigModule {}
