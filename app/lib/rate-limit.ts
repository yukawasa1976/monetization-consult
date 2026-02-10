import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

function createRedis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export const chatLimiter = () =>
  new Ratelimit({
    redis: createRedis(),
    limiter: Ratelimit.slidingWindow(50, "24 h"),
    prefix: "ratelimit:chat",
  });

export const evalLimiter = () =>
  new Ratelimit({
    redis: createRedis(),
    limiter: Ratelimit.slidingWindow(5, "24 h"),
    prefix: "ratelimit:eval",
  });

export async function checkRateLimit(
  request: NextRequest,
  createLimiter: () => Ratelimit
): Promise<{ success: boolean; remaining: number }> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { success: true, remaining: -1 };
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const limiter = createLimiter();
  const { success, remaining } = await limiter.limit(ip);
  return { success, remaining };
}
