/**
 * Đổi tên tệp ảnh trên R2 sang tên lấy từ sản phẩm / bài viết đang dùng nó.
 *
 * Vì sao: Google Images dùng tên tệp làm một tín hiệu xếp hạng. CMS trước đây
 * không truyền tên nên ảnh giữ nguyên tên máy điện thoại đặt, kiểu
 * "z8091011020078-2a0437b6ff18d5df0dabea8c6997fecc-1788521694744.webp".
 *
 * SAO CHÉP, KHÔNG XOÁ BẢN CŨ. Đây là điểm quan trọng nhất của script này.
 * R2 không có lệnh đổi tên — "đổi tên" thật ra là sao chép rồi xoá. Nếu xoá bản
 * cũ thì mọi URL Google đã lập chỉ mục lập tức 404, ảnh rơi khỏi Google Images
 * và phải chờ được tìm lại. Giữ bản cũ thì không URL nào hỏng; bản cũ thành mồ
 * côi và tự rụng dần. Cái giá là vài megabyte dung lượng.
 *
 * Chạy được nhiều lần: ảnh đã mang tên đúng thì bỏ qua.
 *
 * Cách dùng (chạy ở thư mục GaRutinBE, cần .env có DB_* và R2_*):
 *   npx ts-node scripts/doi-ten-anh.ts --thu   # chỉ in ra, KHÔNG đụng gì
 *   npx ts-node scripts/doi-ten-anh.ts         # chạy thật
 */
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { S3Client, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

config();

const THU = process.argv.includes('--thu');

const PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, '');
const BUCKET = process.env.R2_BUCKET ?? '';

/** Bỏ dấu tiếng Việt, chỉ giữ chữ thường, số và gạch ngang. */
function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'anh'
  );
}

/** Bỏ thẻ HTML để lấy tiêu đề sạch. */
const chuThuan = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** Khoá R2 của một URL công khai; null nếu URL không thuộc kho này. */
function khoaTuUrl(url: string): string | null {
  if (!PUBLIC_URL || !url.startsWith(PUBLIC_URL + '/')) return null;
  return url.slice(PUBLIC_URL.length + 1);
}

/**
 * Tên tệp có phải do máy sinh ra không — tức là đáng đổi.
 *
 * Mọi tệp CMS tải lên đều bị gắn thêm dấu thời gian mili-giây (`-1788521694744`),
 * nên một dãy từ 10 chữ số trở lên là dấu hiệu chắc chắn của tên máy đặt.
 *
 * Đây cũng là thứ khiến script chạy lại được nhiều lần: sau khi đổi, tên mới
 * không còn dãy số nào nên lần sau nó bị bỏ qua.
 *
 * Không có phép kiểm này thì một ảnh dùng chung giữa sản phẩm và bài viết sẽ bị
 * đổi tên qua lại mỗi lần chạy — lần này lấy tên sản phẩm, lần sau lấy tên bài
 * viết — và mỗi vòng lại đẻ thêm một bản sao trong kho. Đã gặp thật khi thử.
 */
function tenVoNghia(tenTep: string): boolean {
  return /\d{10,}/.test(tenTep);
}

/** Đuôi tệp, mặc định .webp. */
const duoi = (khoa: string) => (khoa.match(/\.[a-z0-9]+$/i)?.[0] ?? '.webp').toLowerCase();

/** Thư mục chứa tệp, giữ nguyên để không xáo trộn cách sắp xếp sẵn có. */
const thuMuc = (khoa: string) => {
  const i = khoa.lastIndexOf('/');
  return i >= 0 ? khoa.slice(0, i + 1) : '';
};

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT ?? '',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
  /**
   * Mặc định tắt, đúng như R2Service của ứng dụng — R2 dùng kiểu virtual-host
   * (tên bucket nằm trong tên miền).
   *
   * Chỉ bật khi chạy thử với MinIO ở máy: MinIO hiểu kiểu path-style, nhận yêu
   * cầu virtual-host thì nó cắt đoạn đầu của đường dẫn làm tên bucket — khoá
   * "garutin/anh.webp" biến thành bucket "garutin" + khoá "anh.webp", và tệp
   * rơi ra thư mục gốc thay vì nằm trong thư mục. Không có công tắc này thì
   * không thử được toàn bộ luồng trước khi chạy trên dữ liệu thật.
   */
  forcePathStyle: process.env.R2_FORCE_PATH_STYLE === 'true',
});

const db = new DataSource({
  type: 'postgres',
  ...(process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'garutin',
      }),
  synchronize: false,
  logging: false,
});

/** Mọi cột có thể chứa đường dẫn ảnh. Thiếu một cột là ảnh hỏng ở đúng chỗ đó. */
const COT = [
  { bang: 'products', cot: 'images', kieu: 'jsonb' },
  { bang: 'products', cot: 'videos', kieu: 'jsonb' },
  { bang: 'posts', cot: 'cover_image', kieu: 'text' },
  { bang: 'posts', cot: 'content', kieu: 'text' },
  { bang: 'gallery_items', cot: 'url', kieu: 'text' },
  { bang: 'reviews', cot: 'images', kieu: 'jsonb' },
  { bang: 'reviews', cot: 'video', kieu: 'text' },
  { bang: 'media_files', cot: 'url', kieu: 'text' },
  { bang: 'site_config', cot: 'value', kieu: 'text' },
] as const;

async function main() {
  for (const [ten, gt] of Object.entries({ R2_PUBLIC_URL: PUBLIC_URL, R2_BUCKET: BUCKET })) {
    if (!gt) throw new Error(`Thiếu biến môi trường ${ten}`);
  }

  await db.initialize();

  const sanPham: { id: string; name: string; images: string[] }[] = await db.query(
    `SELECT id, name, COALESCE(images, '[]'::jsonb) AS images FROM products ORDER BY created_at`,
  );
  const baiViet: { id: string; title: string; cover_image: string | null; content: string | null }[] =
    await db.query(`SELECT id, title, cover_image, content FROM posts ORDER BY created_at`);

  /** URL cũ → URL mới. Một ảnh dùng ở nhiều nơi chỉ đổi tên một lần. */
  const banDo = new Map<string, string>();
  /** Khoá đã dùng, để hai ảnh không đè lên nhau. */
  const daDung = new Set<string>();

  const dangKy = (url: string, ten: string, thuTu: number) => {
    if (banDo.has(url)) return;
    const khoa = khoaTuUrl(url);
    if (!khoa) return; // ảnh ngoài kho, không đụng tới

    const goc = slug(ten);
    const ext = duoi(khoa);
    const tenTep = khoa.split('/').pop() ?? '';

    // Chỉ đụng vào tệp còn mang tên máy đặt. Tệp đã có tên tử tế thì để yên,
    // kể cả khi tên đó lấy từ một sản phẩm/bài viết khác.
    if (!tenVoNghia(tenTep)) return;

    let moi = thuTu === 0 ? `${thuMuc(khoa)}${goc}${ext}` : `${thuMuc(khoa)}${goc}-${thuTu + 1}${ext}`;
    let n = thuTu + 1;
    while (daDung.has(moi)) {
      n += 1;
      moi = `${thuMuc(khoa)}${goc}-${n}${ext}`;
    }
    daDung.add(moi);
    banDo.set(url, `${PUBLIC_URL}/${moi}`);
  };

  sanPham.forEach((p) => (p.images ?? []).forEach((u, i) => dangKy(u, p.name, i)));
  baiViet.forEach((b) => {
    if (b.cover_image) dangKy(b.cover_image, chuThuan(b.title), 0);
    const trong = (b.content ?? '').match(new RegExp(`${PUBLIC_URL}/[^"'\\s)\\\\]+`, 'g')) ?? [];
    trong.forEach((u, i) => dangKy(u, chuThuan(b.title), i + 1));
  });

  console.log(`\n${banDo.size} ảnh cần đổi tên${THU ? '  (CHẠY THỬ — không đụng gì)' : ''}\n`);
  for (const [cu, moi] of banDo) {
    console.log(`  ${cu.split('/').pop()}\n   → ${moi.split('/').pop()}`);
  }
  if (banDo.size === 0 || THU) {
    await db.destroy();
    return;
  }

  // ── Sao chép trên R2 ────────────────────────────────────────────────────
  let daChep = 0;
  const hong: string[] = [];
  for (const [cu, moi] of banDo) {
    const khoaCu = khoaTuUrl(cu)!;
    const khoaMoi = khoaTuUrl(moi)!;
    try {
      // Đã có sẵn thì thôi — lần chạy trước đã sao chép.
      try {
        await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: khoaMoi }));
        daChep += 1;
        continue;
      } catch {
        /* chưa có, chép tiếp */
      }
      await s3.send(
        new CopyObjectCommand({
          Bucket: BUCKET,
          CopySource: `/${BUCKET}/${encodeURI(khoaCu)}`,
          Key: khoaMoi,
        }),
      );
      daChep += 1;
    } catch (e) {
      hong.push(`${khoaCu}: ${(e as Error).message}`);
    }
  }
  console.log(`\nĐã sao chép ${daChep}/${banDo.size} tệp trên R2`);
  if (hong.length) {
    console.error(`\n${hong.length} tệp lỗi — DỪNG, không đụng vào CSDL:`);
    hong.forEach((h) => console.error('  ' + h));
    await db.destroy();
    process.exitCode = 1;
    return;
  }

  // ── Cập nhật CSDL ───────────────────────────────────────────────────────
  // Chỉ chạy khi TẤT CẢ tệp đã sao chép xong. Cập nhật CSDL trước mà sao chép
  // hỏng là web trỏ tới tệp không tồn tại — ảnh mất trắng.
  const qr = db.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    for (const { bang, cot, kieu } of COT) {
      const co = await qr.query(
        `SELECT to_regclass($1) IS NOT NULL AS co`, [`public.${bang}`],
      );
      if (!co[0]?.co) continue;
      for (const [cu, moi] of banDo) {
        if (kieu === 'jsonb') {
          await qr.query(
            `UPDATE "${bang}" SET "${cot}" = REPLACE("${cot}"::text, $1, $2)::jsonb
              WHERE "${cot}" IS NOT NULL AND strpos("${cot}"::text, $1) > 0`,
            [cu, moi],
          );
        } else {
          await qr.query(
            `UPDATE "${bang}" SET "${cot}" = REPLACE("${cot}", $1, $2)
              WHERE "${cot}" IS NOT NULL AND strpos("${cot}", $1) > 0`,
            [cu, moi],
          );
        }
      }
    }
    await qr.commitTransaction();
    console.log('Đã cập nhật CSDL');
  } catch (e) {
    await qr.rollbackTransaction();
    console.error('Lỗi khi cập nhật CSDL, đã hoàn tác:', (e as Error).message);
    process.exitCode = 1;
  } finally {
    await qr.release();
  }

  // ── Đối chiếu ───────────────────────────────────────────────────────────
  let sot = 0;
  for (const { bang, cot, kieu } of COT) {
    const co = await db.query(`SELECT to_regclass($1) IS NOT NULL AS co`, [`public.${bang}`]);
    if (!co[0]?.co) continue;
    for (const cu of banDo.keys()) {
      const r = await db.query(
        `SELECT COUNT(*)::int AS n FROM "${bang}" WHERE "${cot}" IS NOT NULL AND strpos("${cot}"${kieu === 'jsonb' ? '::text' : ''}, $1) > 0`,
        [cu],
      );
      sot += r[0].n;
    }
  }
  console.log(sot === 0 ? 'Đối chiếu: không còn URL cũ nào trong CSDL ✓' : `Đối chiếu: CÒN ${sot} chỗ dùng URL cũ ✗`);

  await db.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
