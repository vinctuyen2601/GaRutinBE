import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req,
  UseGuards, HttpCode, BadRequestException, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import * as path from 'path';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { R2Service } from '../storage/r2.service';

const header = (req: Request, ten: string): string | undefined => {
  const v = req.headers[ten];
  return Array.isArray(v) ? v[0] : v;
};

/**
 * IP thật của khách, hoặc null khi không xác định được.
 *
 * Máy chủ này nằm sau CloudFront rồi mới tới nginx, nên header
 * x-forwarded-for có dạng "ip-khách, ip-biên-CloudFront". Lấy phần tử ĐẦU như
 * chỗ khác trong dự án đang làm sẽ ra IP khách trong trường hợp thường, nhưng
 * chính phần tử đầu lại là phần khách tự khai được — ai cũng đặt được
 * `X-Forwarded-For: 1.2.3.4` để vượt qua giới hạn mỗi IP một đánh giá.
 *
 * Thứ tự ưu tiên:
 * 1. CloudFront-Viewer-Address — do CloudFront tự đặt, khách không giả được.
 *    Dạng "1.2.3.4:53124" hoặc "[2001:db8::1]:53124" nên phải cắt cổng.
 * 2. Phần tử ÁP CHÓT của x-forwarded-for — phần do nginx nối thêm từ địa chỉ
 *    kết nối thật, cũng không giả được.
 * 3. Không có gì đáng tin thì trả null: KHÔNG chặn còn hơn chặn nhầm. Đánh giá
 *    spam vẫn phải qua bước duyệt nên không lên web, còn gom nhầm mọi khách
 *    vào một IP thì mọi người sau người đầu tiên đều bị từ chối mà không ai
 *    hiểu vì sao.
 */
function ipKhach(req: Request): string | null {
  const cf = header(req, 'cloudfront-viewer-address');
  if (cf) {
    const i = cf.lastIndexOf(':');
    const diaChi = i > 0 ? cf.slice(0, i) : cf;
    return diaChi.replace(/^\[|\]$/g, '') || null;
  }

  const chuoi = header(req, 'x-forwarded-for')
    ?.split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (chuoi && chuoi.length >= 2) return chuoi[chuoi.length - 2];

  return null;
}

@Controller()
export class ReviewsController {
  constructor(
    private readonly svc: ReviewsService,
    private readonly r2: R2Service,
  ) {}

  /**
   * Giới hạn tệp đính kèm đánh giá.
   *
   * Chặt hơn mức 18 MB của mục quản trị: đây là endpoint CÔNG KHAI, ai cũng
   * gọi được mà không cần đăng nhập, nên mỗi megabyte cho phép là một megabyte
   * người lạ ghi được vào kho lưu trữ.
   *
   * Ảnh 8 MB thoải mái cho ảnh chụp điện thoại. Video 18 MB là mức trần nginx
   * cho qua (client_max_body_size 20m) — clip dọc 15 giây thường vừa, quay dài
   * hơn thì khách phải cắt bớt, và câu báo lỗi nói rõ điều đó.
   */
  static readonly TOI_DA_ANH_BYTE = 8 * 1024 * 1024;
  static readonly TOI_DA_VIDEO_BYTE = 18 * 1024 * 1024;

  // ── Công khai ──────────────────────────────────────────────────────────

  /** Đánh giá đã duyệt của một sản phẩm. */
  @Get('reviews/product/:productId')
  findByProduct(@Param('productId') productId: string) {
    return this.svc.findByProduct(productId);
  }

  /**
   * IP mà máy chủ nhìn thấy cho chính người gọi.
   *
   * Chỉ trả về địa chỉ của chính người đang gọi — thứ họ vốn đã biết — nên
   * không lộ gì. Có endpoint này để kiểm chứng được luật "mỗi IP một đánh giá"
   * đang bám vào đúng địa chỉ, thay vì phải đoán từ hành vi chặn.
   */
  @Get('reviews/ip-cua-toi')
  ipCuaToi(@Req() req: Request) {
    return { ip: ipKhach(req) };
  }

  /** Khách gửi đánh giá. Luôn chờ duyệt. */
  @Post('reviews')
  create(@Body() dto: CreateReviewDto, @Req() req: Request) {
    return this.svc.create(dto, ipKhach(req));
  }

  /**
   * Tải một ảnh hoặc một video kèm đánh giá.
   *
   * Endpoint riêng chứ không dùng /admin/media/upload vì mục đó cần đăng nhập.
   * Số lượng (3 ảnh, 1 video) do phía gửi đánh giá kiểm — DTO của
   * POST /reviews chặn, nên tải thừa lên cũng không vào được đánh giá nào.
   */
  @Post('reviews/upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: ReviewsController.TOI_DA_VIDEO_BYTE } }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Không có tệp nào được gửi');

    const laAnh = file.mimetype.startsWith('image/');
    const laVideo = file.mimetype.startsWith('video/');
    if (!laAnh && !laVideo) {
      throw new BadRequestException(`Chỉ nhận ảnh và video, tệp này là ${file.mimetype}`);
    }
    if (laAnh && file.size > ReviewsController.TOI_DA_ANH_BYTE) {
      throw new BadRequestException('Ảnh tối đa 8 MB, vui lòng chọn ảnh nhỏ hơn');
    }
    if (laVideo && file.size > ReviewsController.TOI_DA_VIDEO_BYTE) {
      throw new BadRequestException('Video tối đa 18 MB, vui lòng quay ngắn hơn hoặc cắt bớt');
    }

    const ext = path.extname(file.originalname) || (laVideo ? '.mp4' : '.jpg');
    const key = `garutin/danh-gia/${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    const saved = await this.r2.uploadBuffer(key, file.buffer, file.mimetype);
    return { url: saved.url };
  }

  // ── Quản trị ───────────────────────────────────────────────────────────

  @Get('admin/reviews')
  @UseGuards(JwtAuthGuard)
  findAllForAdmin(
    @Query('status') status?: 'pending' | 'approved',
    @Query('productId') productId?: string,
  ) {
    return this.svc.findAllForAdmin(status, productId);
  }

  /** Quản trị nhập tay một đánh giá (chép từ Zalo/điện thoại), duyệt luôn. */
  @Post('admin/reviews')
  @UseGuards(JwtAuthGuard)
  adminCreate(@Body() dto: CreateReviewDto) {
    return this.svc.adminCreate(dto);
  }

  @Get('admin/reviews/pending-count')
  @UseGuards(JwtAuthGuard)
  async demChoDuyet() {
    return { count: await this.svc.demChoDuyet() };
  }

  @Patch('admin/reviews/:id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.svc.update(id, dto);
  }

  @Delete('admin/reviews/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
