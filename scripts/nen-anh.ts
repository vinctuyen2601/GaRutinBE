/**
 * Nén ảnh gốc trên R2 tại chỗ, giữ nguyên khoá (URL không đổi).
 *
 * Vì sao cần: ảnh trên R2 là ảnh gốc từ máy ảnh/điện thoại, trung vị 1,68 MB.
 * Trước đây Next/Vercel thu nhỏ giúp lúc phục vụ, nhưng tài khoản đã hết hạn
 * mức tối ưu ảnh và mọi ảnh trả về 402. Nén sẵn tại nguồn thì bỏ được hẳn khâu
 * tối ưu của Vercel mà trang vẫn nhẹ.
 *
 * Giữ nguyên khoá là điều kiện bắt buộc: đổi khoá sẽ làm 404 mọi URL Google đã
 * lập chỉ mục, và chính việc đổi tên ảnh hàng loạt là thứ đã đốt hạn mức lần này.
 *
 * AN TOÀN
 * - Sao lưu ảnh gốc sang tiền tố `_goc/` TRƯỚC khi ghi đè.
 * - Đã có bản sao lưu nghĩa là ảnh đó đã xử lý rồi → BỎ QUA. Nếu không, chạy lại
 *   lần hai sẽ nén chồng lên ảnh đã nén và mất chất lượng thêm một lần nữa, đồng
 *   thời đè mất bản gốc thật.
 * - Chỉ ghi đè khi bản mới nhỏ hơn đáng kể; ảnh vốn đã nhẹ thì để yên.
 *
 * Cách dùng (chạy ở thư mục GaRutinBE, cần .env có R2_*):
 *   npx ts-node scripts/nen-anh.ts --thu    # chỉ xem, không ghi gì
 *   npx ts-node scripts/nen-anh.ts          # chạy thật
 */
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import * as dotenv from 'dotenv';

dotenv.config();

const BUCKET = process.env.R2_BUCKET ?? '';
const CHI_THU = process.argv.includes('--thu');

/** Cạnh dài tối đa. 1600px phủ hết mọi khung hiển thị của web, kể cả màn hình 2x. */
const RONG_TOI_DA = 1600;
/** Chất lượng nén. 80 là mức mắt thường khó phân biệt với ảnh gốc. */
const CHAT_LUONG = 80;
/** Dưới mức này coi như đã nhẹ, không đụng tới. */
const BO_QUA_DUOI = 200 * 1024;
/** Chỉ ghi đè khi tiết kiệm được ít nhất chừng này, tránh nén lại vô ích. */
const TIET_KIEM_TOI_THIEU = 0.15;

const TIEN_TO_GOC = '_goc/';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT ?? '',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
  // Xem chú thích trong scripts/doi-ten-anh.ts: chỉ bật khi thử với MinIO.
  forcePathStyle: process.env.R2_FORCE_PATH_STYLE === 'true',
});

const LA_ANH = /\.(jpe?g|png|webp)$/i;
const kb = (n: number) => `${Math.round(n / 1024)}KB`;

async function docHet(stream: any): Promise<Buffer> {
  const phan: Buffer[] = [];
  for await (const c of stream) phan.push(Buffer.from(c));
  return Buffer.concat(phan);
}

async function tonTai(khoa: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: khoa }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Nén một ảnh, trả về cả nội dung mới lẫn kiểu MIME mới.
 *
 * PNG được chuyển sang WebP, các định dạng khác giữ nguyên. Lý do: ảnh nặng
 * nhất trên R2 đều là ảnh CHỤP lưu nhầm dạng PNG — 1,8 MB cho một tấm 1254px.
 * Đo trên chính ba tấm đó: nén lại vẫn dạng PNG chỉ giảm 64% (còn ~660 KB),
 * chuyển sang WebP giảm 92% (còn ~150 KB). WebP cũng hỗ trợ nền trong suốt nên
 * không mất gì kể cả với ảnh cắt nền.
 *
 * Khoá (và do đó URL) KHÔNG đổi, nên tệp tên .png sẽ chứa dữ liệu WebP. Nghe
 * lạ nhưng đúng: trình duyệt quyết định theo Content-Type chứ không theo đuôi
 * tệp. Đổi đuôi đồng nghĩa đổi URL, làm 404 mọi ảnh Google đã lập chỉ mục —
 * cái giá đó lớn hơn nhiều so với việc đuôi tệp không khớp nội dung.
 *
 * JPEG giữ nguyên định dạng: chúng vốn đã nhẹ (37–143 KB), đổi kiểu chỉ thêm
 * rủi ro mà không được bao nhiêu.
 */
async function nen(
  anh: Buffer,
  khoa: string,
): Promise<{ noiDung: Buffer; kieu: string }> {
  const s = sharp(anh, { failOn: 'none' }).rotate().resize({
    width: RONG_TOI_DA,
    withoutEnlargement: true,
  });
  if (/\.png$/i.test(khoa)) {
    return { noiDung: await s.webp({ quality: CHAT_LUONG }).toBuffer(), kieu: 'image/webp' };
  }
  if (/\.webp$/i.test(khoa)) {
    return { noiDung: await s.webp({ quality: CHAT_LUONG }).toBuffer(), kieu: 'image/webp' };
  }
  return {
    noiDung: await s.jpeg({ quality: CHAT_LUONG, mozjpeg: true }).toBuffer(),
    kieu: 'image/jpeg',
  };
}

async function main() {
  for (const [ten, gt] of Object.entries({
    R2_BUCKET: BUCKET,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
  })) {
    if (!gt) {
      console.error(`Thiếu biến môi trường ${ten}`);
      process.exit(1);
    }
  }
  if (CHI_THU) console.log('CHẾ ĐỘ THỬ — không ghi gì lên R2\n');

  // Liệt kê toàn bộ, có phân trang: R2 trả tối đa 1000 khoá mỗi lần.
  const khoas: { Key: string; Size: number }[] = [];
  let tiep: string | undefined;
  do {
    const r = await s3.send(
      new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: tiep }),
    );
    for (const o of r.Contents ?? []) {
      if (o.Key && o.Size && LA_ANH.test(o.Key) && !o.Key.startsWith(TIEN_TO_GOC)) {
        khoas.push({ Key: o.Key, Size: o.Size });
      }
    }
    tiep = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (tiep);

  console.log(`Tìm thấy ${khoas.length} ảnh trên R2\n`);

  let daNen = 0, boQua = 0, loi = 0, truoc = 0, sau = 0;

  for (const { Key, Size } of khoas) {
    if (Size < BO_QUA_DUOI) { boQua++; continue; }

    const khoaGoc = TIEN_TO_GOC + Key;
    if (await tonTai(khoaGoc)) {
      console.log(`  bỏ qua (đã xử lý lần trước): ${Key}`);
      boQua++;
      continue;
    }

    try {
      const goc = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key }));
      const buf = await docHet(goc.Body);
      const { noiDung: moi, kieu } = await nen(buf, Key);

      const tietKiem = 1 - moi.length / buf.length;
      if (tietKiem < TIET_KIEM_TOI_THIEU) {
        console.log(`  bỏ qua (nén không lợi, ${Math.round(tietKiem * 100)}%): ${Key}`);
        boQua++;
        continue;
      }

      console.log(
        `  ${CHI_THU ? '[thử] ' : ''}${kb(buf.length)} → ${kb(moi.length)}  (-${Math.round(tietKiem * 100)}%)  ${Key}`,
      );
      truoc += buf.length; sau += moi.length; daNen++;

      if (CHI_THU) continue;

      // Sao lưu TRƯỚC khi ghi đè. Đảo thứ tự là mất bản gốc nếu lỗi giữa chừng.
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: khoaGoc, Body: buf,
        ContentType: goc.ContentType, CacheControl: 'private, max-age=31536000',
      }));
      // ContentType phải là kiểu MỚI, không phải kiểu cũ: ghi dữ liệu WebP mà
      // vẫn khai image/png thì trình duyệt từ chối vẽ và ảnh hỏng im lặng.
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key, Body: moi,
        ContentType: kieu,
        CacheControl: goc.CacheControl ?? 'public, max-age=31536000',
      }));
    } catch (e: any) {
      console.error(`  LỖI ${Key}: ${e.message}`);
      loi++;
    }
  }

  console.log(`\nĐã nén ${daNen} | bỏ qua ${boQua} | lỗi ${loi}`);
  if (daNen) {
    console.log(`Tổng ${kb(truoc)} → ${kb(sau)}  (-${Math.round((1 - sau / truoc) * 100)}%)`);
  }
  if (!CHI_THU && daNen) {
    console.log(`Bản gốc được giữ ở tiền tố "${TIEN_TO_GOC}" trên cùng bucket.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
