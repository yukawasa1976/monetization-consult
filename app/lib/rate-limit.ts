import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

function createRedis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

// 匿名ユーザー: 50回/24h
export const chatLimiter = () =>
  new Ratelimit({
    redis: createRedis(),
    limiter: Ratelimit.slidingWindow(50, "24 h"),
    prefix: "ratelimit:chat",
  });

// 認証ユーザー: 200回/24h
export const authedChatLimiter = () =>
  new Ratelimit({
    redis: createRedis(),
    limiter: Ratelimit.slidingWindow(200, "24 h"),
    prefix: "ratelimit:chat:authed",
  });

// 匿名ユーザー: 5回/24h
export const evalLimiter = () =>
  new Ratelimit({
    redis: createRedis(),
    limiter: Ratelimit.slidingWindow(5, "24 h"),
    prefix: "ratelimit:eval",
  });

// 認証ユーザー: 20回/24h
export const authedEvalLimiter = () =>
  new Ratelimit({
    redis: createRedis(),
    limiter: Ratelimit.slidingWindow(20, "24 h"),
    prefix: "ratelimit:eval:authed",
  });

export async function checkRateLimit(
  request: NextRequest,
  createLimiter: () => Ratelimit,
  userId?: string | null
): Promise<{ success: boolean; remaining: number }> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { success: true, remaining: -1 };
  }

  const key = userId ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1";
  const limiter = createLimiter();
  const { success, remaining } = await limiter.limit(key);
  return { success, remaining };
}
