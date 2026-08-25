import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Brand,
  Category,
  CategoryBrand,
  CrawlerState,
  Manual,
  ManualCrawlerState,
  Manufacturer,
  Product,
  ScanRun,
} from '../database/entities';
import { MercadoLibreModule } from '../mercadolibre/mercadolibre.module';
import { SearchModule } from '../search/search.module';
import { BootstrapService } from './bootstrap.service';
import { BrandsStoreService } from './brands-store.service';
import { CatalogController } from './catalog.controller';
import { CategoriesStoreService } from './categories-store.service';
import { CrawlerService } from './crawler.service';
import { ManualCrawlerService } from './manual-crawler.service';
import { ManualsService } from './manuals.service';
import { ManufacturersService } from './manufacturers.service';
import { ProductsStoreService } from './products-store.service';
import { ScanService } from './scan.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Brand,
      Category,
      CategoryBrand,
      CrawlerState,
      Manual,
      ManualCrawlerState,
      Manufacturer,
      Product,
      ScanRun,
    ]),
    MercadoLibreModule,
    SearchModule,
  ],
  controllers: [CatalogController],
  providers: [
    CategoriesStoreService,
    BrandsStoreService,
    ProductsStoreService,
    ScanService,
    CrawlerService,
    ManufacturersService,
    ManualsService,
    ManualCrawlerService,
    BootstrapService,
  ],
  exports: [
    CategoriesStoreService,
    BrandsStoreService,
    ProductsStoreService,
    ScanService,
    CrawlerService,
    ManufacturersService,
    ManualsService,
    ManualCrawlerService,
  ],
})
export class CatalogModule {}
