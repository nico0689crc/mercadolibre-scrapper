import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { BrandStrategy } from '../mercadolibre/categories/category.types';
import { CategoriesStoreService } from './categories-store.service';
import { CrawlerService } from './crawler.service';

/**
 * Deja la instancia lista sola: sincroniza el arbol de categorias si la base
 * esta vacia y, si se pide, prende el crawler. Pensado para un deploy nuevo
 * (Railway) donde no hay nadie para correr los POST a mano.
 *
 * Corre en segundo plano a proposito: si bloqueara el arranque, el healthcheck
 * de la plataforma marcaria el deploy como fallido mientras sincroniza.
 */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly categories: CategoriesStoreService,
    private readonly crawler: CrawlerService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    const seed = this.config.get<string>('app.seedOnBoot') === 'true';
    const autostart =
      this.config.get<string>('app.crawlerAutostart') === 'true';

    if (!seed && !autostart) return;

    void this.run(seed, autostart).catch((error: unknown) => {
      this.logger.error(
        `Bootstrap fallo: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  private async run(seed: boolean, autostart: boolean): Promise<void> {
    if (seed) {
      const existing = await this.categories.count();
      if (existing > 0) {
        this.logger.log(
          `Seed omitido: ya hay ${existing} categorias en la base`,
        );
      } else {
        const depth = this.config.get<number>('app.seedDepth', 2);
        this.logger.log(
          `Base vacia: sincronizando el arbol de categorias (depth=${depth})`,
        );
        const result = await this.categories.sync(depth);
        this.logger.log(
          `Seed listo: ${result.categoriesUpserted} categorias en ${result.durationMs}ms`,
        );
      }
    }

    if (autostart) {
      const status = await this.crawler.start({
        strategy: this.config.get<string>(
          'app.crawlerStrategy',
          'catalog',
        ) as BrandStrategy,
        seeds: this.config.get<number>('app.crawlerSeeds', 6),
        pages: this.config.get<number>('app.crawlerPages', 6),
        delaySeconds: this.config.get<number>('app.crawlerDelaySeconds', 60),
      });
      this.logger.log(
        `Crawler activado: ${status.pending} categorias pendientes, ${status.delaySeconds}s entre cada una`,
      );
    }
  }
}
