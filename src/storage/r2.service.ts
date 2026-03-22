import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

  async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    const url = `${this.publicUrl}/${key}`;
    this.logger.log(`Uploaded: ${url}`);
    return url;
  }
}
