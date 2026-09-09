import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TroLyService } from './tro-ly.service';
import { KeywordsService } from './keywords.service';
import { CreateKeywordDto, UpdateKeywordDto } from './dto/keyword.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin/keywords')
@UseGuards(JwtAuthGuard)
export class KeywordsController {
  constructor(private readonly service: KeywordsService,
    private readonly troLy: TroLyService,) {}

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

  /* ── Trợ lý thống kê ───────────────────────────────────────────────────── */

  /** Bảng chính: mỗi từ khoá kèm việc nên làm, xếp theo mức đáng làm. */
  @Get('phan-tich')
  bangPhanTich() {
    return this.troLy.bangPhanTich();
  }

  /** Nhận số liệu xuất từ Search Console; từ khoá lạ sẽ được tạo mới. */
  @Post('nhap-search-console')
  nhapSearchConsole(
    @Body() body: { rows: { keyword: string; impressions: number; clicks: number; position?: number }[] },
  ) {
    return this.troLy.nhapSearchConsole(body?.rows ?? []);
  }

  @Get('goi-y')
  danhSachGoiY() {
    return this.troLy.danhSachGoiY();
  }

  @Post('goi-y/tim')
  timGoiY(@Body() body: { keyword: string }) {
    return this.troLy.layGoiY(body?.keyword ?? '');
  }

  @Post('goi-y/:id/nhan')
  nhanGoiY(@Param('id') id: string) {
    return this.troLy.nhanGoiY(id);
  }

  @Post('goi-y/:id/bo-qua')
  boQuaGoiY(@Param('id') id: string) {
    return this.troLy.boQuaGoiY(id);
  }
}
