import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PageVisit, Platform } from './entities/page-visit.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';

const PLATFORMS: Platform[] = ['facebook', 'youtube', 'tiktok', 'zalo', 'web', 'other'];

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
      if (from) qb.andWhere('v.created_at >= :from', { from });
      if (to) qb.andWhere('v.created_at <= :to', { to: to + 'T23:59:59' });
      return qb;
    };

    const [totalRaw, uniqueRaw, byPlatform, timelineRaw] = await Promise.all([
      buildBase().select('COUNT(*)', 'total').getRawOne<{ total: string }>(),
      buildBase().select('COUNT(DISTINCT v.ip)', 'unique').getRawOne<{ unique: string }>(),
      buildBase()
        .select('v.platform', 'platform')
        .addSelect('COUNT(*)', 'visits')
        .groupBy('v.platform')
        .orderBy('visits', 'DESC')
        .getRawMany<{ platform: string; visits: string }>(),
      buildBase()
        .select("TO_CHAR(v.created_at, 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(*)', 'visits')
        .addSelect('COUNT(DISTINCT v.ip)', 'unique_visitors')
        .groupBy("TO_CHAR(v.created_at, 'YYYY-MM-DD')")
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; visits: string; unique_visitors: string }>(),
    ]);

    return {
      total: Number(totalRaw?.total ?? 0),
      uniqueVisitors: Number(uniqueRaw?.unique ?? 0),
      byPlatform: byPlatform.map(r => ({ platform: r.platform, visits: Number(r.visits) })),
      timeline: timelineRaw.map(r => ({
        date: r.date,
        visits: Number(r.visits),
        uniqueVisitors: Number(r.unique_visitors),
      })),
    };
  }

  async getVisitTable(opts: { from?: string; to?: string; platform?: string; path?: string }) {
    const qb = this.visitRepo.createQueryBuilder('v')
      .select('v.path', 'path')
      .addSelect('v.platform', 'platform')
      .addSelect('COUNT(*)', 'visits')
      .addSelect('COUNT(DISTINCT v.ip)', 'unique_visitors')
      .groupBy('v.path, v.platform')
      .orderBy('visits', 'DESC');

    if (opts.from) qb.andWhere('v.created_at >= :from', { from: opts.from });
    if (opts.to) qb.andWhere('v.created_at <= :to', { to: opts.to + 'T23:59:59' });
    if (opts.platform) qb.andWhere('v.platform = :platform', { platform: opts.platform });
    if (opts.path) qb.andWhere('v.path ILIKE :path', { path: `%${opts.path}%` });

    const rows = await qb.getRawMany<{ path: string; platform: string; visits: string; unique_visitors: string }>();
    return rows.map(r => ({
      path: r.path,
      platform: r.platform,
      visits: Number(r.visits),
      uniqueVisitors: Number(r.unique_visitors),
    }));
  }

  // ── Order stats ──────────────────────────────────────────────────────────────

  async getOrderStats(from?: string, to?: string) {
    const buildBase = () => {
      const qb = this.orderRepo.createQueryBuilder('o')
        .where("o.status != 'cancelled'");
      if (from) qb.andWhere('o.created_at >= :from', { from });
      if (to) qb.andWhere('o.created_at <= :to', { to: to + 'T23:59:59' });
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
        .where(from ? 'o.created_at >= :from' : '1=1', from ? { from } : {})
        .andWhere(to ? 'o.created_at <= :to' : '1=1', to ? { to: to + 'T23:59:59' } : {})
        .groupBy('o.status')
        .getRawMany<{ status: string; count: string }>(),
      buildBase()
        .select('o.source', 'source')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
        .groupBy('o.source')
        .getRawMany<{ source: string; count: string; revenue: string }>(),
      buildBase()
        .select("TO_CHAR(o.created_at, 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(*)', 'orders')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
        .groupBy("TO_CHAR(o.created_at, 'YYYY-MM-DD')")
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
    `, [from, to + 'T23:59:59', limit]);

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
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const getStats = async (ym: string) => {
      const raw = await this.orderRepo.createQueryBuilder('o')
        .select('COUNT(*)', 'orders')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
        .where("o.status != 'cancelled'")
        .andWhere("TO_CHAR(o.created_at, 'YYYY-MM') = :ym", { ym })
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
        .andWhere('v.created_at >= :from', { from })
        .andWhere('v.created_at <= :to', { to: to + 'T23:59:59' })
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
      `, [from, to + 'T23:59:59']),
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
