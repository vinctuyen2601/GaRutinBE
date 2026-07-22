import { Module } from '@nestjs/common';
import { SiteConfigModule } from '../site-config/site-config.module';
import { MailService } from './mail.service';

@Module({
  imports: [SiteConfigModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
