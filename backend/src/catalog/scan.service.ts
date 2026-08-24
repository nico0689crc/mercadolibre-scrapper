import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ScanRun } from '../database/entities';
import { CategoriesService } from '../mercadolibre/categories/categories.service';
import type { BrandStrategy } from '../mercadolibre/categories/category.types';
import { BrandsStoreService } from './brands-store.service';
import { ProductsStoreService } from './products-store.service';

export interface ScanOptions {
  strategy: BrandStrategy;
  seeds: number;
  pages: number;
}

/**
 * Orquesta una corrida: pide marcas a ML, las acumula en la base y deja
 * registro de la peticion en scan_runs.
 */
@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);

  constructor(
    @InjectRepository(ScanRun)
    private readonly runs: Repository<ScanRun>,
    private readonly ml: CategoriesService,
    private readonly store: BrandsStoreService,
    private readonly products: ProductsStoreService,
    config: ConfigService,
  ) {
    this.siteId = config.get<string>('mercadolibre.siteId')!;
  }

  private readonly siteId: string;

  async run(categoryId: string, options: ScanOptions): Promise<ScanRun> {
    const startedAt = Date.now();
    const run = await this.runs.save(
      this.runs.create({
        categoryId,
        strategy: options.strategy,
        seeds: options.seeds,
        pages: options.pages,
        status: 'running',
      }),
    );

    try {
      const scan = await this.ml.scanCategory(
        categoryId,
        options.strategy,
        options.seeds,
        options.pages,
      );
      const { brandsFound, brandsNew, brandIdByKey } =
        await this.store.persistScan(scan);

      // Los productos ya vinieron en el mismo barrido: persistirlos no cuesta requests.
      run.productsStored = await this.products.persist(
        scan.products,
        this.siteId,
        categoryId,
        brandIdByKey,
      );

      run.keywords = scan.keywords;
      run.domainFiltered = scan.domainFiltered;
      run.sampled = scan.sampled;
      run.brandsFound = brandsFound;
      run.brandsNew = brandsNew;
      run.status = 'ok';
    } catch (error) {
      run.status = 'error';
      run.error = error instanceof Error ? error.message : String(error);
      this.logger.error(`Scan de ${categoryId} fallo: ${run.error}`);
    }

    run.durationMs = Date.now() - startedAt;
    return this.runs.save(run);
  }

  recent(limit: number): Promise<ScanRun[]> {
    return this.runs.find({ order: { createdAt: 'DESC' }, take: limit });
  }

  countRuns(): Promise<number> {
    return this.runs.count();
  }
}
