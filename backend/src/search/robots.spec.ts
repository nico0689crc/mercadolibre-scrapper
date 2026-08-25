import { isAllowed, parseRobots } from './robots';

const UA = 'scrapper-products';

describe('robots.txt', () => {
  it('un Disallow dirigido a otro bot no nos afecta', () => {
    // Caso real de whirlpool.com.ar: grepear el archivo daba "sitio cerrado".
    const body = `
User-agent: *
Disallow:

User-agent: Baiduspider
Disallow: /

User-agent: YandexBot
Disallow: /
`;
    const rules = parseRobots(body, UA);
    expect(isAllowed(rules, '/soporte/manuales')).toBe(true);
  });

  it('respeta un Disallow que si aplica al comodin', () => {
    // Caso real de bosch-home.com.
    const rules = parseRobots('User-agent: *\nDisallow: /manual/\n', UA);
    expect(isAllowed(rules, '/manual/algo.pdf')).toBe(false);
    expect(isAllowed(rules, '/soporte/algo.pdf')).toBe(true);
  });

  it('ante reglas que compiten gana el patron mas largo', () => {
    const rules = parseRobots(
      'User-agent: *\nDisallow: /media/\nAllow: /media/manuales/\n',
      UA,
    );
    expect(isAllowed(rules, '/media/interno.pdf')).toBe(false);
    expect(isAllowed(rules, '/media/manuales/x.pdf')).toBe(true);
  });

  it('un grupo especifico para nosotros gana sobre el comodin', () => {
    const rules = parseRobots(
      'User-agent: *\nDisallow: /\n\nUser-agent: scrapper-products\nDisallow:\n',
      UA,
    );
    expect(isAllowed(rules, '/lo-que-sea')).toBe(true);
  });

  it('entiende los comodines * y $', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /*.pdf$\n', UA);
    expect(isAllowed(rules, '/docs/manual.pdf')).toBe(false);
    expect(isAllowed(rules, '/docs/manual.pdf?v=2')).toBe(true);
  });

  it('varios user-agent seguidos comparten el mismo bloque', () => {
    const rules = parseRobots(
      'User-agent: A\nUser-agent: scrapper-products\nDisallow: /x\n',
      UA,
    );
    expect(isAllowed(rules, '/x')).toBe(false);
  });

  it('lee los sitemaps y el crawl-delay', () => {
    const rules = parseRobots(
      'Sitemap: https://x.com/sitemap.xml\nUser-agent: *\nCrawl-delay: 2\nDisallow:\n',
      UA,
    );
    expect(rules.sitemaps).toEqual(['https://x.com/sitemap.xml']);
    expect(rules.crawlDelayMs).toBe(2000);
  });

  it('sin reglas, todo permitido', () => {
    expect(isAllowed(parseRobots('', UA), '/lo-que-sea')).toBe(true);
  });
});
