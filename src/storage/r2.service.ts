import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

export interface UploadResult {
  url: string;
  key: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    const endpoint = process.env.R2_ENDPOINT ?? '';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? '';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? '';
    this.bucket = process.env.R2_BUCKET ?? '';
    this.publicUrl = process.env.R2_PUBLIC_URL ?? '';

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<UploadResult> {
    let finalBuffer = buffer;
    let finalKey = key;
    let finalContentType = contentType;

    if (contentType.startsWith('image/') && contentType !== 'image/gif') {
      finalBuffer = await sharp(buffer)
        /**
         * rotate() không tham số: xoay theo thẻ EXIF của máy ảnh rồi bỏ thẻ đi.
         * Thiếu bước này thì ảnh dọc chụp bằng điện thoại lên web nằm ngang,
         * vì sharp xoá metadata lúc chuyển định dạng còn pixel thì giữ nguyên
         * chiều cũ.
         */
        .rotate()
        /**
         * Chặn cạnh dài ở 1600px. Web không dùng bộ tối ưu ảnh của Next (xem
         * next.config bên GaRutinWeb: hạn mức Vercel cạn là ảnh vỡ sạch), nên
         * tệp tải lên chính là tệp khách tải về — không có ai thu nhỏ giúp.
         *
         * Ảnh hiện tại nhẹ vì được nén tay trước khi tải lên. Khi chụp hàng
         * loạt bằng điện thoại thì không còn khâu đó: một tấm 4000px qua webp
         * q85 vẫn ~800KB, gấp năm lần mức đang chạy.
         *
         * withoutEnlargement: ảnh gốc nhỏ hơn 1600 thì giữ nguyên, phóng to
         * chỉ làm nặng thêm mà không rõ hơn.
         */
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      finalContentType = 'image/webp';
      finalKey = key.replace(/\.[^.]+$/, '.webp');
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: finalKey,
        Body: finalBuffer,
        ContentType: finalContentType,
        /**
         * Hạn dùng lại một năm. Tên tệp có mốc thời gian nên không bao giờ bị
         * ghi đè bằng nội dung khác — đặt immutable là an toàn.
         *
         * Quan trọng với video hơn ảnh nhiều: không có header này thì mỗi lần
         * khách mở lại trang là tải lại cả tệp vài megabyte.
         */
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    const url = `${this.publicUrl}/${finalKey}`;
    this.logger.log(`Uploaded: ${url}`);
    return { url, key: finalKey, mimeType: finalContentType, size: finalBuffer.length };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    this.logger.log(`Deleted: ${key}`);
  }
}
