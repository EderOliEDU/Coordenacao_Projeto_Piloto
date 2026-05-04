import rateLimit from 'express-rate-limit';

/**
 * Rate limiter específico para a rota de login:
 * máximo 10 tentativas por IP a cada 15 minutos.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter global da API:
 * máximo 100 requisições por IP por minuto.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Muitas requisições. Tente novamente em breve.' },
  standardHeaders: true,
  legacyHeaders: false,
});
