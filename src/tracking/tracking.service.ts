import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PageVisit, Platform } from './entities/page-visit.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';

const PLATFORMS: Platform[] = ['facebook', 'youtube', 'tiktok', 'zalo', 'web', 'other'];

const dateStart = (d: string) => d + 'T00:00:00+07:00';
const dateEnd   = (d: string) => d + 'T23:59:59+07:00';

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(PageVisit)
    private readonly visitRepo: Repository<PageVisit>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async track(dto: {
    platform: string;
    path: string;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    const platform = (PLATFORMS.includes(dto.platform as Platform) ? dto.platform : 'other') as Platform;
    await this.visitRepo.save(this.visitRepo.create({
      platform,
      path: dto.path,
      ip: dto.ip || null,
      userAgent: dto.userAgent || null,
    }));
  }

  // ── Visit stats ──────────────────────────────────────────────────────────────

  async getVisitStats(from?: string, to?: string) {
    const buildBase = () => {
      const qb = this.visitRepo.createQueryBuilder('v');
      if (from) qb.andWhere('v.created_at >= :from', { from: dateStart(from) });
      if (to) qb.andWhere('v.created_at <= :to', { to: dateEnd(to) });
      return qb;
    };

    const [totalRaw, uniqueRaw, timelineRaw] = await Promise.all([
      buildBase().select('COUNT(*)', 'total').getRawOne<{ total: string }>(),
      buildBase().select('COUNT(DISTINCT v.ip)', 'unique').getRawOne<{ unique: string }>(),
      buildBase()
        .select("TO_CHAR(v.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(*)', 'visits')
        .addSelect('COUNT(DISTINCT v.ip)', 'unique_visitors')
        .groupBy("TO_CHAR(v.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')")
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; visits: string; unique_visitors: string }>(),
    ]);

    return {
      total: Number(totalRaw?.total ?? 0),
      uniqueVisitors: Number(uniqueRaw?.unique ?? 0),
      timeline: timelineRaw.map(r => ({
        date: r.date,
        visits: Number(r.visits),
        uniqueVisitors: Number(r.unique_visitors),
      })),
    };
  }

  /**
   * Khách ghé thăm vào những khung giờ nào trong ngày.
   *
   * Để trại biết lúc nào nên đăng bài, chạy quảng cáo và trực Zalo. Đăng lúc
   * không ai online thì bài chìm mất trước khi có người thấy.
   *
   * Chia sáu khung ĐỀU NHAU bốn tiếng, không chia theo "sáng/trưa/chiều" dài
   * ngắn khác nhau: khung 2 tiếng và khung 5 tiếng đặt cạnh nhau thì con số
   * không so sánh được, mà bảng lại trông như so sánh được.
   *
   * Chỉ MỘT lần `AT TIME ZONE 'Asia/Ho_Chi_Minh'` vì cả page_visits.created_at
   * lẫn orders.created_at ở đây đều là TIMESTAMPTZ (đã kiểm bằng
   * information_schema) — Postgres tự biết mốc UTC, đổi thẳng sang giờ Việt là
   * đủ. Lưu ý: bên 17Fishing cột này là TIMESTAMP trần lưu giờ UTC nên phải đổi
   * hai bước; chép qua chép lại giữa hai dự án là lệch đúng 7 tiếng mà bảng
   * vẫn trông rất hợp lý.
   *
   * Đơn hàng gom theo giờ của CHÍNH nó, không truy ngược về lượt xem dẫn tới
   * đơn: câu hỏi ở đây là "khách đặt hàng vào lúc nào", để biết lúc nào cần
   * người trực điện thoại.
   */
  async getHourStats(from?: string, to?: string) {
    const GIO_VN = `AT TIME ZONE 'Asia/Ho_Chi_Minh'`;

    const visitQb = this.visitRepo.createQueryBuilder('v')
      .select(`FLOOR(EXTRACT(HOUR FROM v.created_at ${GIO_VN}) / 4)::int`, 'bucket')
      .addSelect('COUNT(*)', 'visits')
      .addSelect('COUNT(DISTINCT v.ip)', 'visitors')
      .groupBy('1');
    if (from) visitQb.andWhere('v.created_at >= :from', { from: dateStart(from) });
    if (to) visitQb.andWhere('v.created_at <= :to', { to: dateEnd(to) });

    const orderQb = this.orderRepo.createQueryBuilder('o')
      .select(`FLOOR(EXTRACT(HOUR FROM o.created_at ${GIO_VN}) / 4)::int`, 'bucket')
      .addSelect('COUNT(*)', 'orders')
      .where("o.status != 'cancelled'")
      .groupBy('1');
    if (from) orderQb.andWhere('o.created_at >= :from', { from: dateStart(from) });
    if (to) orderQb.andWhere('o.created_at <= :to', { to: dateEnd(to) });

    const [visits, orders] = await Promise.all([
      visitQb.getRawMany<{ bucket: number; visits: string; visitors: string }>(),
      orderQb.getRawMany<{ bucket: number; orders: string }>(),
    ]);

    const vMap = new Map(visits.map(r => [Number(r.bucket), r]));
    const oMap = new Map(orders.map(r => [Number(r.bucket), Number(r.orders)]));

    // Luôn trả đủ sáu khung kể cả khung không có ai: khung vắng cũng là thông
    // tin, và bảng thiếu dòng thì người đọc tưởng chưa có dữ liệu.
    return Array.from({ length: 6 }, (_, b) => ({
      bucket: b,
      label: `${String(b * 4).padStart(2, '0')}–${String(b * 4 + 4).padStart(2, '0')}h`,
      visits: Number(vMap.get(b)?.visits ?? 0),
      visitors: Number(vMap.get(b)?.visitors ?? 0),
      orders: oMap.get(b) ?? 0,
    }));
  }

  async getVisitTable(opts: { from?: string; to?: string; path?: string }) {
    const qb = this.visitRepo.createQueryBuilder('v')
      .select('v.path', 'path')
      .addSelect('COUNT(*)', 'visits')
      .addSelect('COUNT(DISTINCT v.ip)', 'unique_visitors')
      .groupBy('v.path')
      .orderBy('visits', 'DESC');

    if (opts.from) qb.andWhere('v.created_at >= :from', { from: dateStart(opts.from) });
    if (opts.to) qb.andWhere('v.created_at <= :to', { to: dateEnd(opts.to) });
    if (opts.path) qb.andWhere('v.path ILIKE :path', { path: `%${opts.path}%` });

    const rows = await qb.getRawMany<{ path: string; visits: string; unique_visitors: string }>();
    return rows.map(r => ({
      path: r.path,
      visits: Number(r.visits),
      uniqueVisitors: Number(r.unique_visitors),
    }));
  }

  // ── Order stats ──────────────────────────────────────────────────────────────

  async getOrderStats(from?: string, to?: string) {
    const buildBase = () => {
      const qb = this.orderRepo.createQueryBuilder('o')
        .where("o.status != 'cancelled'");
      if (from) qb.andWhere('o.created_at >= :from', { from: dateStart(from) });
      if (to) qb.andWhere('o.created_at <= :to', { to: dateEnd(to) });
      return qb;
    };

    const [totalRaw, byStatus, bySource, timelineRaw] = await Promise.all([
      buildBase()
        .select('COUNT(*)', 'orders')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
        .getRawOne<{ orders: string; revenue: string }>(),
      this.orderRepo.createQueryBuilder('o')
        .select('o.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where(from ? 'o.created_at >= :from' : '1=1', from ? { from: dateStart(from) } : {})
        .andWhere(to ? 'o.created_at <= :to' : '1=1', to ? { to: dateEnd(to) } : {})
        .groupBy('o.status')
        .getRawMany<{ status: string; count: string }>(),
      buildBase()
        .select('o.source', 'source')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
        .groupBy('o.source')
        .getRawMany<{ source: string; count: string; revenue: string }>(),
      buildBase()
        .select("TO_CHAR(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(*)', 'orders')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
        .groupBy("TO_CHAR(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')")
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; orders: string; revenue: string }>(),
    ]);

    return {
      totalOrders: Number(totalRaw?.orders ?? 0),
      totalRevenue: Number(totalRaw?.revenue ?? 0),
      byStatus: byStatus.map(r => ({ status: r.status, count: Number(r.count) })),
      bySource: bySource.map(r => ({ source: r.source, count: Number(r.count), revenue: Number(r.revenue) })),
      timeline: timelineRaw.map(r => ({
        date: r.date,
        orders: Number(r.orders),
        revenue: Number(r.revenue),
      })),
    };
  }

  // ── Top products ─────────────────────────────────────────────────────────────

  async getTopProducts(from: string, to: string, limit = 20) {
    const rows = await this.orderRepo.query(`
      SELECT
        item->>'productId'  AS product_id,
        item->>'name'       AS name,
        item->>'unit'       AS unit,
        SUM((item->>'quantity')::int)                              AS total_qty,
        SUM((item->>'price')::numeric * (item->>'quantity')::int) AS total_revenue,
        COUNT(DISTINCT o.id)                                       AS order_count
      FROM orders o
      CROSS JOIN jsonb_array_elements(o.items) AS item
      WHERE o.status != 'cancelled'
        AND o.created_at >= $1
        AND o.created_at <= $2
      GROUP BY item->>'productId', item->>'name', item->>'unit'
      ORDER BY total_qty DESC
      LIMIT $3
    `, [dateStart(from), dateEnd(to), limit]);

    return rows.map((r: any) => ({
      productId: r.product_id,
      name: r.name,
      unit: r.unit ?? 'con',
      totalQty: Number(r.total_qty),
      totalRevenue: Number(r.total_revenue),
      orderCount: Number(r.order_count),
    }));
  }

  // ── Monthly compare ───────────────────────────────────────────────────────────

  async getMonthlyCompare() {
    // Dùng Intl với timeZone cố định thay vì Date.getFullYear()/getMonth() —
    // 2 hàm đó đọc theo giờ hệ thống server (thường UTC), sai lệch với giờ VN
    // trong vài tiếng đầu mỗi tháng mới.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(new Date());
    const year = Number(parts.find((p) => p.type === 'year')!.value);
    const monthNum = Number(parts.find((p) => p.type === 'month')!.value);

    const month = `${year}-${String(monthNum).padStart(2, '0')}`;
    const prevTotal = year * 12 + (monthNum - 1) - 1;
    const prevYear = Math.floor(prevTotal / 12);
    const prevMonthNum = (prevTotal % 12) + 1;
    const prevMonth = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;

    const getStats = async (ym: string) => {
      const raw = await this.orderRepo.createQueryBuilder('o')
        .select('COUNT(*)', 'orders')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
        .where("o.status != 'cancelled'")
        .andWhere("TO_CHAR(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') = :ym", { ym })
        .getRawOne<{ orders: string; revenue: string }>();
      return { orders: Number(raw?.orders ?? 0), revenue: Number(raw?.revenue ?? 0) };
    };

    const [current, previous] = await Promise.all([getStats(month), getStats(prevMonth)]);

    const growth = (cur: number, prev: number) =>
      prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);

    return {
      month,
      prevMonth,
      current,
      previous,
      revenueGrowth: growth(current.revenue, previous.revenue),
      ordersGrowth: growth(current.orders, previous.orders),
    };
  }

  // ── Product conversion ────────────────────────────────────────────────────────

  async getProductConversion(from: string, to: string) {
    const [products, visitRows, orderRows] = await Promise.all([
      this.productRepo.find({ select: ['id', 'name', 'slug'], where: { isActive: true } }),
      this.visitRepo.createQueryBuilder('v')
        .select('v.path', 'path')
        .addSelect('COUNT(*)', 'visits')
        .where("v.path LIKE '/san-pham/%'")
        .andWhere('v.created_at >= :from', { from: dateStart(from) })
        .andWhere('v.created_at <= :to', { to: dateEnd(to) })
        .groupBy('v.path')
        .getRawMany<{ path: string; visits: string }>(),
      this.orderRepo.query(`
        SELECT
          item->>'productId' AS product_id,
          COUNT(DISTINCT o.id) AS orders
        FROM orders o
        CROSS JOIN jsonb_array_elements(o.items) AS item
        WHERE o.status != 'cancelled'
          AND o.created_at >= $1
          AND o.created_at <= $2
        GROUP BY item->>'productId'
      `, [dateStart(from), dateEnd(to)]),
    ]);

    const visitsBySlug: Record<string, number> = {};
    for (const row of visitRows) {
      const slug = row.path.replace('/san-pham/', '');
      visitsBySlug[slug] = Number(row.visits);
    }

    const ordersByProductId: Record<string, number> = {};
    for (const row of orderRows) {
      if (row.product_id) ordersByProductId[row.product_id] = Number(row.orders);
    }

    return products
      .map(p => {
        const views = visitsBySlug[p.slug] ?? 0;
        const orders = ordersByProductId[p.id] ?? 0;
        const conversionRate = views > 0 ? Math.round((orders / views) * 1000) / 10 : null;
        return { productId: p.id, name: p.name, slug: p.slug, views, orders, conversionRate };
      })
      .filter(r => r.views > 0 || r.orders > 0)
      .sort((a, b) => (b.views + b.orders * 10) - (a.views + a.orders * 10));
  }
}
