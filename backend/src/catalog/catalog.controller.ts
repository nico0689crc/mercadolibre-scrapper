import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import type { Category, Product, ScanRun } from '../database/entities';
import { BrandsStoreService, type StoredBrand } from './brands-store.service';
import {
  CategoriesStoreService,
  type CategoryList,
  type CategoryNode,
  type SyncResult,
} from './categories-store.service';
import { CrawlerService, type CrawlerStatus } from './crawler.service';
import { CrawlerSettingsDto } from './dto/crawler-settings.dto';
import { ImportManualsDto } from './dto/import-manuals.dto';
import { ListBrandsDto } from './dto/list-brands.dto';
import {
  AcceptManufacturerDto,
  CandidatesQueryDto,
  ListManufacturersDto,
  RejectManufacturerDto,
  SegmentDto,
} from './dto/manufacturer.dto';
import { ListCategoriesDto } from './dto/list-categories.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { ScanCategoryDto } from './dto/scan-category.dto';
import { SyncCategoriesDto } from './dto/sync-categories.dto';
import {
  ProductsStoreService,
  type DomainOption,
  type ProductList,
} from './products-store.service';
import { ManualCrawlerService } from './manual-crawler.service';
import { ManualsService } from './manuals.service';
import { ManufacturersService } from './manufacturers.service';
import { ScanService } from './scan.service';

export interface CatalogStats {
  categories: number;
  brands: number;
  categoryBrandLinks: number;
  products: number;
  scans: number;
}

export interface CategoryWithBrands {
  category: Category;
  children: Category[];
  brands: StoredBrand[];
}

/**
 * Todo lo que sirve este controller sale de la base, no de ML.
 * Para ir a ML en vivo estan las rutas /api/categories (proxy sin persistir).
 */
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly categories: CategoriesStoreService,
    private readonly brands: BrandsStoreService,
    private readonly products: ProductsStoreService,
    private readonly scans: ScanService,
    private readonly crawler: CrawlerService,
    private readonly manufacturers: ManufacturersService,
    private readonly manuals: ManualsService,
    private readonly manualCrawler: ManualCrawlerService,
  ) {}

  /** Estado del llenado progresivo. */
  @Get('crawler')
  getCrawler(): Promise<CrawlerStatus> {
    return this.crawler.status();
  }

  /** Arranca el llenado progresivo (o actualiza su configuracion en caliente). */
  @Post('crawler/start')
  startCrawler(@Body() body: CrawlerSettingsDto): Promise<CrawlerStatus> {
    return this.crawler.start(body);
  }

  @Post('crawler/stop')
  stopCrawler(): Promise<CrawlerStatus> {
    return this.crawler.stop();
  }

  @Get('stats')
  async getStats(): Promise<CatalogStats> {
    const [categories, brands, categoryBrandLinks, products, scans] =
      await Promise.all([
        this.categories.count(),
        this.brands.countBrands(),
        this.brands.countLinks(),
        this.products.count(),
        this.scans.countRuns(),
      ]);
    return { categories, brands, categoryBrandLinks, products, scans };
  }

  /**
   * Categorias persistidas, filtrables. Sin nada devuelve las raices; `parent`
   * trae las hijas directas, `branch` una rama entera y `scope=all` el arbol.
   */
  @Get('categories')
  getCategories(@Query() query: ListCategoriesDto): Promise<CategoryList> {
    return this.categories.find(query);
  }

  /**
   * Arbol completo y liviano para la cascada de filtros.
   * Va antes de `categories/:id`, si no `tree` entra como id.
   */
  @Get('categories/tree')
  getCategoryTree(): Promise<CategoryNode[]> {
    return this.categories.tree();
  }

  @Get('categories/:id')
  async getCategory(@Param('id') id: string): Promise<CategoryWithBrands> {
    const [category, children, brands] = await Promise.all([
      this.categories.findOne(id),
      this.categories.findChildren(id),
      this.brands.findByCategory(id),
    ]);
    return { category, children, brands };
  }

  /** Marcas acumuladas de una categoria. */
  @Get('categories/:id/brands')
  getCategoryBrands(@Param('id') id: string): Promise<StoredBrand[]> {
    return this.brands.findByCategory(id);
  }

  /** Marcas globales, con en cuantas categorias aparece cada una. */
  @Get('brands')
  listBrands(@Query() query: ListBrandsDto) {
    return this.brands.findAll({
      limit: query.limit,
      offset: query.offset,
      search: query.search,
      branch: query.branch,
      minProducts: query.minProducts,
      minCategories: query.minCategories,
      sort: query.sort,
      dir: query.dir,
    });
  }

  /** Dominios de catalogo presentes, para el select del filtro de productos. */
  @Get('domains')
  getDomains(
    @Query('categoryId') categoryId?: string,
    @Query('branch') branch?: string,
  ): Promise<DomainOption[]> {
    return this.products.domains(categoryId, branch);
  }

  /**
   * Productos de catalogo guardados. Se puede filtrar por categoria, por marca
   * o por texto, y combinarlos.
   */
  @Get('products')
  listProducts(@Query() query: ListProductsDto): Promise<ProductList> {
    return this.products.find({
      categoryId: query.categoryId,
      branch: query.branch,
      brandId: query.brandId,
      search: query.search,
      domainId: query.domainId,
      status: query.status,
      brand: query.brand,
      photo: query.photo,
      limit: query.limit,
      offset: query.offset,
      sort: query.sort,
      dir: query.dir,
    });
  }

  /** Detalle completo de un producto. `?refresh=1` fuerza releer de ML. */
  @Get('products/:id')
  getProduct(
    @Param('id') id: string,
    @Query('refresh') refresh?: string,
  ): Promise<Product> {
    return this.products.findOne(id, refresh === '1' || refresh === 'true');
  }

  /** Segmentos donde tiene sentido buscar fabricantes. */
  @Get('manufacturers/segments')
  getSegments() {
    return this.manufacturers.segments();
  }

  /** Marcas del segmento que pasan el filtro automatico. No escribe nada. */
  @Get('manufacturers/candidates')
  getCandidates(@Query() query: CandidatesQueryDto) {
    return this.manufacturers.candidates(
      query.segment,
      query.includeAll ?? false,
    );
  }

  /** Los numeros que sostienen el criterio, calculados en vivo sobre la base. */
  @Get('manufacturers/methodology')
  getMethodology(@Query() query: SegmentDto) {
    return this.manufacturers.methodology(query.segment);
  }

  /** Fabricantes ya registrados, filtrables por segmento y estado. */
  @Get('manufacturers')
  listManufacturers(@Query() query: ListManufacturersDto) {
    return this.manufacturers.list(query.segment, query.status);
  }

  @Get('manufacturers/counts')
  manufacturerCounts() {
    return this.manufacturers.counts();
  }

  /** Congela los candidatos del segmento como filas `candidate`. Idempotente. */
  @Post('manufacturers/detect')
  detectManufacturers(@Body() body: SegmentDto) {
    return this.manufacturers.detect(body.segment);
  }

  /** Cuantas consultas de busqueda quedan este mes. */
  @Get('manufacturers/quota')
  getQuota() {
    return this.manufacturers.quotaUsage();
  }

  /**
   * Propone el dominio oficial de la marca. `?search=0` usa solo la heuristica
   * del nombre y no consume cupo. No guarda nada: es una propuesta.
   */
  @Get('manufacturers/:brandId/resolve-domain')
  resolveDomain(
    @Param('brandId') brandId: string,
    @Query('search') search?: string,
  ) {
    return this.manufacturers.resolveDomain(
      brandId,
      search !== '0' && search !== 'false',
    );
  }

  /** Acepta la marca como fabricante, con sus dominios oficiales. */
  @Post('manufacturers/:brandId/accept')
  acceptManufacturer(
    @Param('brandId') brandId: string,
    @Body() body: AcceptManufacturerDto,
  ) {
    return this.manufacturers.accept(brandId, body.officialDomains, body.notes);
  }

  /** Descarta la marca: vendedor de marketplace, marca propia o basura. */
  @Post('manufacturers/:brandId/reject')
  rejectManufacturer(
    @Param('brandId') brandId: string,
    @Body() body: RejectManufacturerDto,
  ) {
    return this.manufacturers.reject(brandId, body.notes);
  }

  /** Estado del worker que baja manuales. */
  @Get('manuals/crawler')
  manualCrawlerStatus() {
    return this.manualCrawler.status();
  }

  /** Prende el worker de manuales. Espera solo la ventana horaria de cada sitio. */
  @Post('manuals/crawler/start')
  startManualCrawler(@Body() body: { restaleDays?: number; verify?: boolean }) {
    return this.manualCrawler.start(body ?? {});
  }

  @Post('manuals/crawler/stop')
  stopManualCrawler() {
    return this.manualCrawler.stop();
  }

  /**
   * Busca en la web los manuales de los modelos que el crawl no encontro.
   * Cuesta una consulta del cupo por modelo, de ahi el `limit`.
   */
  @Post('manufacturers/:brandId/search-manuals')
  searchManuals(
    @Param('brandId') brandId: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = Number(limit);
    return this.manuals.searchMissing(
      brandId,
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 10,
    );
  }

  /** Trae los manuales que encontro otro entorno, para no volver a pagarlos. */
  @Post('manuals/import')
  importManuals(@Body() body: ImportManualsDto) {
    return this.manuals.importFrom(body);
  }

  /** Manuales ya descubiertos. */
  @Get('manuals')
  listManuals(@Query('brandId') brandId?: string) {
    return this.manuals.list(brandId);
  }

  @Get('manuals/stats')
  manualStats() {
    return this.manuals.stats();
  }

  /**
   * Recorre el sitio oficial del fabricante buscando manuales. `?verify=0` no
   * descarga los PDF para confirmarlos (mas rapido, menos certeza).
   */
  @Post('manufacturers/:brandId/crawl-manuals')
  crawlManuals(
    @Param('brandId') brandId: string,
    @Query('verify') verify?: string,
  ) {
    return this.manuals.crawlBrand(
      brandId,
      verify !== '0' && verify !== 'false',
    );
  }

  @Get('scans')
  getScans(@Query('limit') limit?: string): Promise<ScanRun[]> {
    const parsed = Number(limit);
    return this.scans.recent(
      Number.isFinite(parsed) && parsed > 0 ? parsed : 20,
    );
  }

  /** Trae el arbol de categorias desde ML y lo persiste. */
  @Post('sync')
  sync(@Body() body: SyncCategoriesDto): Promise<SyncResult> {
    return this.categories.sync(body.depth, body.siteId);
  }

  /** Corre un scan de marcas contra ML y acumula el resultado en la base. */
  @Post('categories/:id/scan')
  scan(
    @Param('id') id: string,
    @Body() body: ScanCategoryDto,
  ): Promise<ScanRun> {
    return this.scans.run(id, {
      strategy: body.strategy,
      seeds: body.seeds,
      pages: body.pages,
    });
  }
}
