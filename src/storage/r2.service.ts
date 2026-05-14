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
      finalBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
      finalContentType = 'image/webp';
      finalKey = key.replace(/\.[^.]+$/, '.webp');
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: finalKey,
        Body: finalBuffer,
        ContentType: finalContentType,
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
