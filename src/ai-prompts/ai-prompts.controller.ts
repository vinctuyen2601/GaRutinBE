import { Controller, Get, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiPromptsService } from './ai-prompts.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class AiPromptsController {
  constructor(private readonly service: AiPromptsService) {}

  @Get('admin/ai-prompts')
  danhSach() {
    return this.service.danhSach();
  }

  @Put('admin/ai-prompts/:key')
  luu(@Param('key') key: string, @Body() body: { content: string }) {
    return this.service.luu(key, body?.content ?? '');
  }

  @Delete('admin/ai-prompts/:key')
  datLai(@Param('key') key: string) {
    return this.service.datLai(key);
  }
}
