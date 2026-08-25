/**
 * Parser de robots.txt segun RFC 9309.
 *
 * Existe porque grepear el archivo da respuestas erroneas: el "Disallow: /" de
 * whirlpool.com.ar aplica solo a Baiduspider, naverbot y YandexBot, y leerlo
 * sin mirar a que grupo pertenece hace creer que el sitio entero esta cerrado.
 */

interface Rule {
  allow: boolean;
  path: string;
}

export interface RobotsRules {
  /** Reglas del grupo que aplica a nuestro user-agent. */
  rules: Rule[];
  crawlDelayMs: number | null;
  sitemaps: string[];
}

/** Un robots.txt vacio o inaccesible: todo permitido, que es el default del RFC. */
export const ALLOW_ALL: RobotsRules = {
  rules: [],
  crawlDelayMs: null,
  sitemaps: [],
};

export function parseRobots(body: string, userAgent: string): RobotsRules {
  const groups = new Map<string, Rule[]>();
  const delays = new Map<string, number>();
  const sitemaps: string[] = [];

  // Varios User-agent seguidos comparten el mismo bloque de reglas.
  let currentAgents: string[] = [];
  let expectingAgents = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;

    const separator = line.indexOf(':');
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'sitemap') {
      sitemaps.push(value);
      continue;
    }

    if (field === 'user-agent') {
      // Un user-agent despues de reglas abre un grupo nuevo.
      if (!expectingAgents) currentAgents = [];
      currentAgents.push(value.toLowerCase());
      expectingAgents = true;
      continue;
    }

    if (currentAgents.length === 0) continue;
    expectingAgents = false;

    if (field === 'allow' || field === 'disallow') {
      for (const agent of currentAgents) {
        const rules = groups.get(agent) ?? [];
        // "Disallow:" vacio significa permitir todo, no prohibir todo.
        if (field === 'disallow' && value === '') {
          rules.push({ allow: true, path: '/' });
        } else if (value !== '') {
          rules.push({ allow: field === 'allow', path: value });
        }
        groups.set(agent, rules);
      }
      continue;
    }

    if (field === 'crawl-delay') {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) {
        for (const agent of currentAgents) delays.set(agent, seconds * 1000);
      }
    }
  }

  // Gana el user-agent mas especifico que matchee; si ninguno, el comodin.
  const target = userAgent.toLowerCase();
  let best: string | null = null;
  for (const agent of groups.keys()) {
    if (agent === '*') continue;
    if (
      target.includes(agent) &&
      (best === null || agent.length > best.length)
    ) {
      best = agent;
    }
  }
  const chosen = best ?? '*';

  return {
    rules: groups.get(chosen) ?? [],
    crawlDelayMs: delays.get(chosen) ?? delays.get('*') ?? null,
    sitemaps,
  };
}

/**
 * Decide si una ruta esta permitida. Ante reglas que compiten gana la de patron
 * mas largo, y a igual longitud gana Allow, como pide el RFC.
 */
export function isAllowed(rules: RobotsRules, path: string): boolean {
  let winner: Rule | null = null;

  for (const rule of rules.rules) {
    if (!matches(rule.path, path)) continue;
    if (
      winner === null ||
      rule.path.length > winner.path.length ||
      (rule.path.length === winner.path.length && rule.allow && !winner.allow)
    ) {
      winner = rule;
    }
  }

  return winner ? winner.allow : true;
}

/** Soporta los comodines del RFC: * cualquier cosa, $ fin de la ruta. */
function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;

  const escaped = body
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');

  return new RegExp(`^${escaped}${anchored ? '$' : ''}`).test(path);
}
