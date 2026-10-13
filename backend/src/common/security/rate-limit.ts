import { createHash } from 'crypto';

// Limite de requisições em memória, sem dependência externa. Dois baldes:
//  - público: rotas sem login (login, recuperação de senha, cadastro/login do portal, 2FA do
//    super admin) - baixo, é onde robôs e força bruta atuam;
//  - api: todo o resto, chaveado pelo token do usuário (cookie/Authorization) e, sem token, pelo
//    IP - assim um escritório inteiro atrás do mesmo IP não divide a mesma cota.
// Em memória significa por instância do backend; atrás de várias réplicas o limite efetivo
// multiplica. Desligar: RATE_LIMIT=off. Ajustar: RATE_LIMIT_API_PER_MIN / RATE_LIMIT_PUBLIC_PER_MIN.
const WINDOW_MS = 60_000;

const PUBLIC_PATHS = [
  /^\/api\/auth\/(login|forgot-password|reset-password)\b/,
  /^\/api\/portal\/public\//,
  /^\/api\/super-admin\/auth\//,
];
// Health check e webhook do Inter (tem limitador próprio) nunca entram na conta.
const EXEMPT_PATHS = [/^\/api\/health\b/, /^\/api\/inter\/webhook\b/];

interface Bucket { count: number; resetAt: number }

export interface RateLimitOptions {
  apiPerMinute?: number;
  publicPerMinute?: number;
  now?: () => number;
}

export function createRateLimiter(options: RateLimitOptions = {}) {
  const apiLimit = options.apiPerMinute ?? (Number(process.env.RATE_LIMIT_API_PER_MIN) || 600);
  const publicLimit = options.publicPerMinute ?? (Number(process.env.RATE_LIMIT_PUBLIC_PER_MIN) || 40);
  const now = options.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  const cleanup = setInterval(() => {
    const t = now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= t) buckets.delete(key);
  }, WINDOW_MS);
  cleanup.unref?.();

  const identity = (req: any): string => {
    const header = String(req.headers?.authorization || '');
    const cookie = String(req.headers?.cookie || '').match(/(?:^|;\s*)(?:access_token|portal_token)=([^;]+)/)?.[1];
    const token = header.startsWith('Bearer ') ? header.slice(7) : cookie || '';
    return token ? 'u:' + createHash('sha256').update(token).digest('hex').slice(0, 24) : 'ip:' + (req.ip || req.socket?.remoteAddress || 'unknown');
  };

  return function rateLimit(req: any, res: any, next: () => void) {
    if (String(process.env.RATE_LIMIT || 'on').toLowerCase() === 'off') return next();
    const path = String(req.path || req.url || '').split('?')[0];
    if (EXEMPT_PATHS.some((re) => re.test(path))) return next();

    const isPublic = PUBLIC_PATHS.some((re) => re.test(path));
    // Rotas públicas são sempre contadas por IP: o token (quando existe) não prova nada ali.
    const key = (isPublic ? 'pub:ip:' + (req.ip || req.socket?.remoteAddress || 'unknown') : 'api:' + identity(req));
    const limit = isPublic ? publicLimit : apiLimit;
    const t = now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= t) { bucket = { count: 0, resetAt: t + WINDOW_MS }; buckets.set(key, bucket); }
    bucket.count += 1;
    if (bucket.count > limit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - t) / 1000))));
      res.status(429).json({ statusCode: 429, message: 'Muitas requisições. Aguarde um instante e tente novamente.' });
      return;
    }
    next();
  };
}
