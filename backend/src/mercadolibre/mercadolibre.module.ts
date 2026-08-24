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
