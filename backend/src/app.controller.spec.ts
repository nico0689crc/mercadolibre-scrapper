import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: unknown) =>
              ({ 'app.env': 'test', 'mercadolibre.siteId': 'MLA' })[key] ??
              fallback,
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('devuelve status ok con el site configurado', () => {
      const health = appController.getHealth();
      expect(health.status).toBe('ok');
      expect(health.env).toBe('test');
      expect(health.siteId).toBe('MLA');
      expect(Date.parse(health.timestamp)).not.toBeNaN();
    });
  });
});
