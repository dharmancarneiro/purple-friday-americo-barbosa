const headers = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

// Política de conteúdo: tudo do próprio domínio. O navegador não fala com o Supabase (as chamadas são feitas
// no servidor), por isso connect-src é só 'self'. Imagens https cobrem as miniaturas dos anúncios.
// 'unsafe-inline' é exigido pelos scripts de inicialização do Next; em desenvolvimento também vale 'unsafe-eval'.
const dev = process.env.NODE_ENV !== 'production';
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'" + (dev ? ' ws: wss:' : ''),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');
headers.push({ key: 'Content-Security-Policy', value: csp });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Há outro package-lock.json em C:\Users\juanc; fixa a raiz neste projeto.
  outputFileTracingRoot: import.meta.dirname,
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [{ source: '/:path*', headers }];
  },
};

export default nextConfig;
