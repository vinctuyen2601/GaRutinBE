import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiPrompt } from './entities/ai-prompt.entity';
import { AI_PROMPTS, timKhaiBao, thayBien } from './registry';

@Injectable()
export class AiPromptsService {
  constructor(
    @InjectRepository(AiPrompt)
    private readonly repo: Repository<AiPrompt>,
  ) {}

  /**
   * Lấy nội dung prompt đang có hiệu lực, đã thay biến.
   *
   * Đọc CSDL mỗi lần gọi chứ không cache: một lượt gọi LLM mất hàng giây, thêm
   * một truy vấn theo khoá chính là không đáng kể — đổi lại, sửa prompt trong
   * CMS là có hiệu lực ngay, không phải khởi động lại máy chủ.
   *
   * Mọi lỗi CSDL đều rơi về prompt mặc định: prompt hỏng thì chức năng AI chết
   * hẳn, còn dùng mặc định thì cùng lắm là mất phần tuỳ chỉnh.
   */
  async lay(key: string, bien: Record<string, string> = {}): Promise<string> {
    const khai = timKhaiBao(key);
    if (!khai) throw new NotFoundException(`Prompt "${key}" không tồn tại`);

    let noiDung = khai.macDinh;
    try {
      const ghiDe = await this.repo.findOne({ where: { key } });
      if (ghiDe?.content?.trim()) noiDung = ghiDe.content;
    } catch {
      // Giữ nguyên bản mặc định.
    }
    return thayBien(noiDung, bien);
  }

  /** Danh sách cho CMS: mặc định, bản đã sửa (nếu có), và các biến dùng được. */
  async danhSach() {
    const ghiDe = await this.repo.find();
    const map = new Map(ghiDe.map((g) => [g.key, g]));
    return AI_PROMPTS.map((p) => {
      const g = map.get(p.key);
      return {
        key: p.key,
        nhom: p.nhom,
        nhan: p.nhan,
        moTa: p.moTa,
        bien: p.bien,
        macDinh: p.macDinh,
        noiDung: g?.content ?? p.macDinh,
        daSua: Boolean(g),
        suaLuc: g?.updatedAt ?? null,
      };
    });
  }

  async luu(key: string, content: string) {
    const khai = timKhaiBao(key);
    if (!khai) throw new NotFoundException(`Prompt "${key}" không tồn tại`);
    await this.repo.save({ key, content });
    return { ok: true };
  }

  /** Xoá bản ghi đè để quay về prompt mặc định trong mã nguồn. */
  async datLai(key: string) {
    await this.repo.delete({ key });
    return { ok: true };
  }
}
