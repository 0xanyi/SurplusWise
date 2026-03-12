type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

function cleanup(now: number) {
  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function checkRateLimit(key: string, config: RateLimitConfig) {
  const now = Date.now();
  cleanup(now);

  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + config.windowMs };
    store.set(key, next);
    return {
      success: true,
      remaining: config.limit - 1,
      resetAt: next.resetAt,
    };
  }

  if (current.count >= config.limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  store.set(key, current);

  return {
    success: true,
    remaining: config.limit - current.count,
    resetAt: current.resetAt,
  };
}
