import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SiteConfigService } from './site-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString } from 'class-validator';

class UpdateSiteConfigDto {
  @IsString()
  key: string;

  @IsString()
  value: string;
}

@Controller()
export class SiteConfigController {
  constructor(private service: SiteConfigService) {}

  @Get('site-config')
  findAll() {
    return this.service.findAll();
  }

  @Patch('admin/site-config')
  @UseGuards(JwtAuthGuard)
  update(@Body() dto: UpdateSiteConfigDto) {
    return this.service.upsert(dto.key, dto.value);
  }
}
