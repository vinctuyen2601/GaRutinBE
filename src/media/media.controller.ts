import {
  Controller, Post, Get, Delete, UseInterceptors, UploadedFile,
  UseGuards, BadRequestException, Param, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MediaService } from './media.service';
import * as path from 'path';

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';
}

@Controller('admin/media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private service: MediaService) {}

  /**
   * Kích thước tối đa cho một tệp tải lên.
   *
   * Trước đây KHÔNG có giới hạn nào: multer giữ cả tệp trong RAM, nên một
   * video 200 MB là 200 MB bộ nhớ máy chủ cho đúng một yêu cầu. Vài người tải
   * cùng lúc là máy chủ chết.
   *
   * Con số 18 MB không phải chọn bừa: nginx trước ứng dụng đặt
   * client_max_body_size 20m, đo thật trên máy chủ — tệp 20.000.000 byte qua
   * được, đúng 20 MiB thì trả 413. Vượt ngưỡng đó là nginx chặn TRƯỚC khi
   * yêu cầu tới đây, và khách thấy trang lỗi thô của nginx chứ không thấy câu
   * báo lỗi tử tế nào.
   *
   * Chừa 2 MB dưới ngưỡng cho phần bao multipart và các trường đi kèm.
   *
   * Muốn nhận tệp lớn hơn thì phải nới client_max_body_size trước, rồi mới
   * nâng số ở đây — nâng riêng bên này chỉ tạo ra lời hứa mà nginx không giữ.
   *
   * 18 MB đủ cho ảnh và cho clip ngắn 10–15 giây đã nén. Video dài hơn thì
   * đăng YouTube rồi dán link — vừa không tốn bộ nhớ máy chủ, vừa chạy mượt
   * trên 4G nhờ YouTube tự nén nhiều mức chất lượng.
   */
  static readonly TOI_DA = 18 * 1024 * 1024;

  /**
   * Chỉ nhận ảnh và video.
   *
   * Không phải chuyện bảo mật — tệp nằm trên tên miền riêng và được phục vụ
   * tĩnh — mà để chặn nhầm lẫn: kéo nhầm một tệp .zip hay .pdf vào đây thì nó
   * lên kho ảnh, không ai hiển thị được, và không ai nhớ để xoá.
   */
  static readonly LOAI_CHO_PHEP = /^(image|video)\//;

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MediaController.TOI_DA } }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('name') name?: string,
  ) {
    if (!file) throw new BadRequestException('Không có file');
    if (!MediaController.LOAI_CHO_PHEP.test(file.mimetype)) {
      throw new BadRequestException(
        `Chỉ nhận ảnh và video, tệp này là ${file.mimetype}`,
      );
    }
    const ext = path.extname(file.originalname) || '.jpg';
    const raw = name || path.basename(file.originalname, ext);
    const key = `garutin/${toSlug(raw)}-${Date.now()}${ext}`;
    const saved = await this.service.upload(key, file);
    return saved;
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
