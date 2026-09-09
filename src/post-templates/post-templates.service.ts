import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostTemplateEntity } from './entities/post-template.entity';
import { POST_TEMPLATES as GOC } from '../posts/post-templates';

/** id chỉ nhận chữ thường, số và gạch ngang — nó đi thẳng vào khoá prompt và URL. */
const ID_HOP_LE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

@Injectable()
export class PostTemplatesService {
  constructor(
    @InjectRepository(PostTemplateEntity)
    private readonly repo: Repository<PostTemplateEntity>,
  ) {}

  /** Danh sách cho CMS — gồm cả khuôn đã tắt, để còn bật lại. */
  tatCa(): Promise<PostTemplateEntity[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  /** Danh sách cho ô chọn trong trang soạn bài — chỉ khuôn đang bật. */
  dangDung(): Promise<PostTemplateEntity[]> {
    return this.repo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Tra một khuôn để dựng prompt.
   *
   * Trả về null khi không có id, id lạ, HOẶC khuôn đã bị tắt — cả ba trường hợp
   * đều phải rơi về ba quy tắc mặc định. Riêng trường hợp đã tắt là điểm dễ sai:
   * bài cũ vẫn giữ template_id của khuôn vừa tắt, và nếu vẫn dùng nó thì việc
   * tắt khuôn chẳng có tác dụng gì.
   */
  async tra(id?: string): Promise<PostTemplateEntity | null> {
    if (!id) return null;
    return this.repo.findOne({ where: { id, isActive: true } });
  }

  async them(dto: {
    id: string;
    name: string;
    description?: string;
    brief: string;
    sortOrder?: number;
  }) {
    if (!ID_HOP_LE.test(dto.id)) {
      throw new BadRequestException(
        'Mã khuôn chỉ gồm chữ thường không dấu, số và gạch ngang. Ví dụ: huong-dan-nhanh',
      );
    }
    if (await this.repo.findOne({ where: { id: dto.id } })) {
      throw new BadRequestException(`Mã khuôn "${dto.id}" đã tồn tại`);
    }
    if (!dto.brief?.trim()) {
      throw new BadRequestException('Nội dung hướng dẫn cho AI không được để trống');
    }
    return this.repo.save(
      this.repo.create({ ...dto, description: dto.description ?? '', isBuiltin: false }),
    );
  }

  async sua(
    id: string,
    dto: Partial<Pick<PostTemplateEntity, 'name' | 'description' | 'brief' | 'sortOrder' | 'isActive'>>,
  ) {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Khuôn không tồn tại');
    // KHÔNG cho đổi id: id đã nằm trong posts.template_id của các bài cũ.
    Object.assign(t, dto);
    if (!t.brief?.trim()) {
      throw new BadRequestException('Nội dung hướng dẫn cho AI không được để trống');
    }
    return this.repo.save(t);
  }

  /**
   * Xoá hẳn — chỉ cho phép với khuôn tự thêm và chưa bài nào dùng.
   *
   * Khuôn dựng sẵn thì tắt chứ không xoá, để nút khôi phục còn chỗ mà khôi phục.
   */
  async xoa(id: string) {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Khuôn không tồn tại');
    if (t.isBuiltin) {
      throw new BadRequestException(
        'Khuôn dựng sẵn không xoá được — hãy tắt nó đi, bài cũ vẫn hiểu được khuôn của mình',
      );
    }
    const [{ count }] = await this.repo.query(
      'SELECT COUNT(*)::int AS count FROM posts WHERE template_id = $1',
      [id],
    );
    if (count > 0) {
      throw new BadRequestException(
        `Đang có ${count} bài dùng khuôn này. Hãy tắt thay vì xoá, để bài cũ không mất khuôn.`,
      );
    }
    await this.repo.delete({ id });
    return { ok: true };
  }

  /** Đưa một khuôn dựng sẵn về đúng nội dung gốc trong mã nguồn. */
  async khoiPhuc(id: string) {
    const goc = GOC.find((g) => g.id === id);
    if (!goc) throw new BadRequestException('Khuôn này không phải khuôn dựng sẵn');
    await this.repo.save({
      id: goc.id,
      name: goc.name,
      description: goc.description,
      brief: goc.brief,
      isActive: true,
      isBuiltin: true,
    });
    return { ok: true };
  }
}
