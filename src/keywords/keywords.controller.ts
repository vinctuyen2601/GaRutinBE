import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { KeywordsService } from './keywords.service';
import { CreateKeywordDto, UpdateKeywordDto } from './dto/keyword.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin/keywords')
@UseGuards(JwtAuthGuard)
export class KeywordsController {
  constructor(private readonly service: KeywordsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('active')
  findActive() {
    return this.service.findActive();
  }

  @Post()
  create(@Body() dto: CreateKeywordDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateKeywordDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/activate')
  setActive(@Param('id') id: string) {
    return this.service.setActive(id);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
