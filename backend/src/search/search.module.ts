import { Agent } from 'node:https';

import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SearchQuota } from '../database/entities';
import { BraveSearchService } from './brave-search.service';
import { DomainResolverService } from './domain-resolver.service';

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
  providers: [BraveSearchService, DomainResolverService],
  exports: [BraveSearchService, DomainResolverService],
})
export class SearchModule {}
