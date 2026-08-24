import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Brand,
  Category,
  CategoryBrand,
  CrawlerState,
  Product,
  ScanRun,
} from '../database/entities';
import { MercadoLibreModule } from '../mercadolibre/mercadolibre.module';
import { BootstrapService } from './bootstrap.service';
import { BrandsStoreService } from './brands-store.service';
import { CatalogController } from './catalog.controller';
import { CategoriesStoreService } from './categories-store.service';
import { CrawlerService } from './crawler.service';
import { ProductsStoreService } from './products-store.service';
import { ScanService } from './scan.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Brand,
      Category,
      CategoryBrand,
      CrawlerState,
      Product,
      ScanRun,
    ]),
    MercadoLibreModule,
  ],
  controllers: [CatalogController],
  providers: [
    CategoriesStoreService,
    BrandsStoreService,
    ProductsStoreService,
    ScanService,
    CrawlerService,
    BootstrapService,
  ],
  exports: [
    CategoriesStoreService,
    BrandsStoreService,
    ProductsStoreService,
    ScanService,
    CrawlerService,
  ],
})
export class CatalogModule {}
