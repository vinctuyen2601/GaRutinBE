import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
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
  bangPhanTich(@Query('boQua') boQua?: string) {
    return this.troLy.bangPhanTich(boQua === 'true');
  }

  /** Bỏ qua một từ khoá không liên quan, hoặc nhận lại. */
  @Patch(':id/bo-qua')
  doiBoQua(@Param('id') id: string, @Body() body: { boQua: boolean; lyDo?: string }) {
    return this.troLy.doiBoQua(id, body?.boQua ?? true, body?.lyDo);
  }

  /** Nhận số liệu xuất từ Search Console; từ khoá lạ sẽ được tạo mới. */
  @Post('nhap-search-console')
  nhapSearchConsole(
    @Body() body: { rows: { keyword: string; impressions: number; clicks: number; position?: number }[] },
  ) {
    return this.troLy.nhapSearchConsole(body?.rows ?? []);
  }

  /** Kéo số liệu thẳng từ Search Console bằng service account. */
  @Post('dong-bo-search-console')
  dongBoSearchConsole(@Body() body: { soNgay?: number }) {
    return this.troLy.dongBoSearchConsole(body?.soNgay ?? 90);
  }

  /** Cho CMS biết có nên hiện nút đồng bộ không. */
  @Get('gsc-san-sang')
  gscSanSang() {
    return { sanSang: this.troLy.daCauHinhGsc() };
  }

  @Get('goi-y')
  danhSachGoiY() {
    return this.troLy.danhSachGoiY();
  }

  @Post('goi-y/tim')
  timGoiY(@Body() body: { keyword: string }) {
    return this.troLy.layGoiY(body?.keyword ?? '');
  }

  /** Tìm gợi ý từ mọi từ khoá đang có, khỏi phải tự nghĩ từ gốc. */
  @Post('goi-y/quet-sau')
  quetSau(@Body() body: { soTuGoc?: number }) {
    return this.troLy.quetSau(body?.soTuGoc ?? 12);
  }

  @Post('goi-y/:id/nhan')
  nhanGoiY(@Param('id') id: string) {
    return this.troLy.nhanGoiY(id);
  }

  @Post('goi-y/:id/bo-qua')
  boQuaGoiY(@Param('id') id: string) {
    return this.troLy.boQuaGoiY(id);
  }

  /** Soạn phần bổ sung bằng AI. */
  @Post('bo-sung')
  soanBoSung(@Body() body: { keyword: string; slugs: string[] }) {
    return this.troLy.soanBoSung(body?.keyword, body?.slugs ?? []);
  }

  /** Đường làm tay, dùng khi gọi LLM qua API hỏng hoặc hết hạn mức. */
  @Post('bo-sung/prompt')
  async promptBoSung(@Body() body: { keyword: string; slugs: string[] }) {
    const { system, user } = await this.troLy.promptBoSung(body?.keyword, body?.slugs ?? []);
    return { system, user, prompt: `${system}\n\n---\n\n${user}` };
  }

  @Post('bo-sung/apply')
  applyBoSung(@Body() body: { text: string }) {
    return this.troLy.docKetQuaBoSung(body?.text ?? '');
  }
}
