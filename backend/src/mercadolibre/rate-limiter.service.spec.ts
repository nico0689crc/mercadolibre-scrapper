import { ConfigService } from '@nestjs/config';

import { RateLimiterService } from './rate-limiter.service';

function limiter(perSecond: number, burst: number): RateLimiterService {
  const config = {
    get: (key: string) =>
      ({
        'mercadolibre.rateLimitPerSecond': perSecond,
        'mercadolibre.rateLimitBurst': burst,
      })[key],
  } as unknown as ConfigService;
  return new RateLimiterService(config);
}

describe('RateLimiterService', () => {
  it('deja pasar la rafaga inicial sin esperar', async () => {
    const service = limiter(10, 5);
    const started = Date.now();

    await Promise.all(Array.from({ length: 5 }, () => service.acquire()));

    expect(Date.now() - started).toBeLessThan(50);
  });

  it('frena lo que excede la rafaga', async () => {
    // 20/s => un token cada 50ms. 3 sobrantes ~ 150ms.
    const service = limiter(20, 2);
    const started = Date.now();

    await Promise.all(Array.from({ length: 5 }, () => service.acquire()));
    const elapsed = Date.now() - started;

    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(elapsed).toBeLessThan(600);
  });

  it('respeta el orden de llegada', async () => {
    const service = limiter(50, 1);
    const order: number[] = [];

    await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        service.acquire().then(() => {
          order.push(i);
        }),
      ),
    );

    expect(order).toEqual([0, 1, 2, 3]);
  });

  it('penalize vacia el bucket y obliga a esperar', async () => {
    const service = limiter(20, 5);
    await service.acquire();

    service.penalize();
    const started = Date.now();
    await service.acquire();

    expect(Date.now() - started).toBeGreaterThanOrEqual(40);
  });
});
