import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Header } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import {
  GenerateProductDescriptionDto,
  OptimizeProductSeoDto,
  ImproveProductDescriptionDto,
} from './dto/ai-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class ProductsController {
  constructor(private service: ProductsService) {}

  @Get('products')
  findAll(
    @Query('category') categoryId?: string,
    @Query('featured') featured?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      categoryId,
      featured: featured === 'true',
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('feed/google')
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  async googleFeed(): Promise<string> {
    const products = await this.service.findAll({ limit: 500 });
    const siteUrl = process.env.WEB_URL || 'https://garutin.com';

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const stripHtml = (s: string) =>
      s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const stockMap: Record<string, string> = {
      in_stock: 'in stock',
      out_of_stock: 'out of stock',
      pre_order: 'preorder',
    };

    const items = products
      .filter((p) => p.images?.length > 0)
      .map((p) => {
        const price = Number(p.price);
        const salePrice = p.salePrice ? Number(p.salePrice) : null;
        const hasValidSale = salePrice && salePrice > 0;
        // Nếu price=0, dùng salePrice làm giá niêm yết
        const gPrice = price > 0 ? price : (hasValidSale ? salePrice! : 0);
        const gSalePrice = price > 0 && hasValidSale ? salePrice : null;

        const desc = esc(stripHtml(p.description ?? p.name)).slice(0, 500);
        const title = esc(p.name);
        const image = p.images[0];

        return `    <item>
      <g:id>${p.id}</g:id>
      <title>${title}</title>
      <description>${desc}</description>
      <link>${siteUrl}/san-pham/${p.slug}</link>
      <g:image_link>${image}</g:image_link>
      <g:price>${gPrice.toFixed(0)} VND</g:price>${gSalePrice ? `\n      <g:sale_price>${gSalePrice.toFixed(0)} VND</g:sale_price>` : ''}
      <g:availability>${stockMap[p.stockStatus] ?? 'in stock'}</g:availability>
      <g:condition>new</g:condition>
      <g:brand>GaRutin</g:brand>
      <g:google_product_category>Animals &amp; Pet Supplies &gt; Live Animals</g:google_product_category>
      <g:product_type>Gà rutin cảnh</g:product_type>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>GaRutin - Gà Rutin Cảnh Thuần Chủng</title>
    <link>${siteUrl}</link>
    <description>Chuyên cung cấp gà rutin cảnh thuần chủng, nhiều màu lông đẹp, giao hàng toàn quốc</description>
${items}
  </channel>
</rss>`;
  }

  @Get('products/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get('admin/products')
  @UseGuards(JwtAuthGuard)
  findAllAdmin() {
    return this.service.findAllAdmin();
  }

  @Post('admin/products')
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Patch('admin/products/:id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }

  @Delete('admin/products/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('admin/products/ai/generate-description')
  @UseGuards(JwtAuthGuard)
  generateDescription(@Body() dto: GenerateProductDescriptionDto) {
    return this.service.generateDescription(dto);
  }

  @Post('admin/products/ai/optimize-seo')
  @UseGuards(JwtAuthGuard)
  optimizeSeo(@Body() dto: OptimizeProductSeoDto) {
    return this.service.optimizeSeo(dto);
  }

  @Post('admin/products/ai/improve-description')
  @UseGuards(JwtAuthGuard)
  improveDescription(@Body() dto: ImproveProductDescriptionDto) {
    return this.service.improveDescription(dto);
  }
}
