import { Controller, Post, UseGuards } from '@nestjs/common';
import { CanhService } from './canh.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin/canh')
@UseGuards(JwtAuthGuard)
export class CanhController {
  constructor(private readonly canh: CanhService) {}

  /**
   * Chạy tay ngay, không chờ tới giờ hẹn.
   *
   * Có nó thì kiểm được tác vụ định kỳ mà không phải đợi sang hôm sau — và
   * quan trọng hơn: sau mỗi đợt sửa lớn có thể gọi ngay để biết mình vừa làm
   * hỏng gì. Bên 17fishing, phép canh chạy lần đầu đã bắt ngay 3 liên kết chết
   * do chính đợt gộp bài cùng ngày sinh ra.
   */
  @Post('chay')
  chay() {
    return this.canh.chayHangNgay();
  }
}
