import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        const client = new Redis(redisUrl, {
          lazyConnect: true,
          retryStrategy: (times) => {
            if (times > 3) return null; // Avoid infinite loops in tests when redis is absent
            return Math.min(times * 100, 1000);
          },
        });
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  async onModuleDestroy() {
    // Graceful disconnect
  }
}
