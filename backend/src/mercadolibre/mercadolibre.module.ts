import { Agent } from 'node:https';

import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import { MlApiService } from './ml-api.service';
import { MlAuthService } from './ml-auth.service';
import { RateLimiterService } from './rate-limiter.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 15_000,
      maxRedirects: 3,
      // Sin keep-alive, cada request abre socket nuevo y resuelve DNS de nuevo.
      // Con el crawler en paralelo eso satura el resolver del contenedor y
      // aparecen EAI_AGAIN y ECONNABORTED que no tienen nada que ver con ML.
      httpsAgent: new Agent({
        keepAlive: true,
        keepAliveMsecs: 30_000,
        maxSockets: 32,
        scheduling: 'fifo',
      }),
    }),
  ],
  controllers: [CategoriesController],
  providers: [
    RateLimiterService,
    MlAuthService,
    MlApiService,
    CategoriesService,
  ],
  exports: [MlApiService, CategoriesService],
})
export class MercadoLibreModule {}
