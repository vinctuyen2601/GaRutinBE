import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface DongGSC {
  keyword: string;
  clicks: number;
  impressions: number;
  position: number;
}

/**
 * Lấy số liệu Search Console bằng service account.
 *
 * Không dùng thư viện googleapis: chỉ cần đúng hai lời gọi HTTP, mà gói đó kéo
 * theo vài chục megabyte. Node có sẵn crypto ký được RS256 nên tự tạo JWT là đủ.
 *
 * Search Console KHÔNG cho dùng API key — đây là dữ liệu riêng của website nên
 * bắt buộc OAuth hoặc service account. Service account là đường duy nhất không
 * cần con người bấm đồng ý, tức là tự động hoá được.
 */
@Injectable()
export class SearchConsoleService {
  private readonly logger = new Logger(SearchConsoleService.name);

  private get cauHinh() {
    const email = process.env.GSC_CLIENT_EMAIL;
    // Biến môi trường không giữ được xuống dòng thật, nên khoá thường được dán
    // dưới dạng có \n. Không đổi lại thì crypto báo "no start line" rất khó hiểu.
    const key = (process.env.GSC_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const site = process.env.GSC_SITE_URL;
    return { email, key, site };
  }

  daCauHinh(): boolean {
    const { email, key, site } = this.cauHinh;
    return Boolean(email && key && site);
  }

  private b64(x: unknown): string {
    return Buffer.from(typeof x === 'string' ? x : JSON.stringify(x))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  /** Tự ký JWT rồi đổi lấy access token. Token sống 1 giờ, không cần lưu lại. */
  private async layToken(): Promise<string> {
    const { email, key } = this.cauHinh;
    const now = Math.floor(Date.now() / 1000);
    const head = this.b64({ alg: 'RS256', typ: 'JWT' });
    const body = this.b64({
      iss: email,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    });
    const sig = crypto
      .createSign('RSA-SHA256')
      .update(`${head}.${body}`)
      .end()
      .sign(key)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${head}.${body}.${sig}`,
      }),
    });
    const data: any = await res.json();
    if (!res.ok) {
      const loi = data.error_description || data.error || String(res.status);
      throw new BadRequestException(
        `Không lấy được token Google: ${loi}${this.chanDoan(loi)}`,
      );
    }
    return data.access_token;
  }

  /**
   * Mô tả tình trạng khoá để kèm vào thông báo lỗi.
   *
   * Có mặt vì "Invalid JWT Signature" không nói được gì về nguyên nhân: khoá
   * cụt, khoá của service account khác, hay khoá đã bị xoá trên Google Cloud
   * đều ra đúng một dòng chữ đó. Không có thông tin này thì phải SSH vào máy
   * chủ chạy lệnh mới biết — mà lúc đang hỏng thì đó là rào cản thật.
   *
   * TUYỆT ĐỐI không in nội dung khoá, chỉ in các chỉ số về nó.
   */
  private chanDoan(loi: string): string {
    if (!/signature|invalid_grant|JWT/i.test(loi)) return '';
    const { email, key } = this.cauHinh;
    const y: string[] = [];

    let hopLe = false;
    try {
      crypto.createPrivateKey(key);
      hopLe = true;
    } catch {
      /* để nguyên hopLe = false */
    }

    y.push(`khoá dài ${key.length} ký tự (bản đủ khoảng 1700)`);
    y.push(`${key.split('\n').length} dòng (bản đủ khoảng 28)`);
    y.push(hopLe ? 'định dạng hợp lệ' : 'ĐỊNH DẠNG HỎNG');
    y.push(`email ${email}`);

    const khuyen = !hopLe
      ? 'Khoá sai định dạng — dán lại, nhớ bọc trong dấu nháy kép và giữ nguyên các \\n.'
      : key.length < 1500
        ? 'Khoá bị cắt cụt — nhiều khả năng thiếu dấu nháy kép nên shell cắt ở khoảng trắng.'
        : 'Khoá đúng định dạng nhưng Google không nhận: nhiều khả năng khoá và email KHÔNG cùng một tệp JSON, hoặc khoá đã bị xoá trên Google Cloud. Lấy lại cả hai từ đúng một tệp.';

    return `\n[chẩn đoán] ${y.join(' · ')}\n[nên làm] ${khuyen}`;
  }

  /**
   * Lấy truy vấn trong N ngày gần nhất.
   *
   * Search Console trễ khoảng 2 ngày nên không có dữ liệu của hôm nay — lấy tới
   * hôm qua để tránh dòng cuối luôn bằng 0 và làm người đọc tưởng lưu lượng tụt.
   */
  async layTruyVan(soNgay = 90, gioiHan = 500): Promise<DongGSC[]> {
    const { site } = this.cauHinh;
    if (!this.daCauHinh()) {
      throw new BadRequestException(
        'Chưa cấu hình GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY và GSC_SITE_URL trên máy chủ',
      );
    }

    const token = await this.layToken();
    const ngay = (lui: number) =>
      new Date(Date.now() - lui * 86400_000).toISOString().slice(0, 10);

    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site!)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: ngay(soNgay),
          endDate: ngay(1),
          dimensions: ['query'],
          rowLimit: gioiHan,
        }),
      },
    );
    const data: any = await res.json();
    if (!res.ok) {
      // 403 gần như luôn là quên thêm service account vào Search Console —
      // nói thẳng ra thay vì để người dùng đoán, vì khoá vẫn đúng nên rất dễ
      // đi tìm nhầm chỗ.
      const goiY =
        res.status === 403
          ? ` — kiểm tra đã thêm ${this.cauHinh.email} vào Search Console (Cài đặt → Người dùng và quyền) chưa, và GSC_SITE_URL có đúng dạng không (vd sc-domain:garutin.com)`
          : '';
      throw new BadRequestException(
        `Search Console trả lỗi: ${data.error?.message || res.status}${goiY}`,
      );
    }

    return (data.rows || []).map((r: any) => ({
      keyword: r.keys?.[0] ?? '',
      clicks: Math.round(r.clicks ?? 0),
      impressions: Math.round(r.impressions ?? 0),
      position: Number((r.position ?? 0).toFixed(1)),
    })).filter((r: DongGSC) => r.keyword);
  }
}
