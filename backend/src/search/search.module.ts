import { Agent } from 'node:https';

import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SearchQuota } from '../database/entities';
import { BraveSearchService } from './brave-search.service';
import { DomainResolverService } from './domain-resolver.service';
import { ManualFinderService } from './manual-finder.service';
import { SiteCrawlerService } from './site-crawler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SearchQuota]),
    HttpModule.register({
      timeout: 15_000,
      maxRedirects: 3,
      // Verificar dominios abre conexiones a muchos hosts distintos: sin
      // keep-alive se satura el resolver, como paso con el crawler.
      httpsAgent: new Agent({
        keepAlive: true,
        keepAliveMsecs: 30_000,
        maxSockets: 16,
      }),
    }),
  ],
  providers: [
    BraveSearchService,
    DomainResolverService,
    SiteCrawlerService,
    ManualFinderService,
  ],
  exports: [
    BraveSearchService,
    DomainResolverService,
    SiteCrawlerService,
    ManualFinderService,
  ],
})
export class SearchModule {}
