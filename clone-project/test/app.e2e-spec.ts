import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PG_POOL } from '../src/infrastructure/database/database.module';
import { REDIS_CLIENT } from '../src/infrastructure/redis/redis.module';

describe('SyncCord API E2E Integration Tests', () => {
  let app: INestApplication;

  // Mock database and redis so integration tests can run without live containers in CI
  const mockPool = {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    on: jest.fn(),
    end: jest.fn(),
  };

  const mockRedis = {
    on: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn(),
    hset: jest.fn(),
    hget: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(mockPool)
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedis)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v10', {
      exclude: ['/', 'health'],
    });
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should reject unauthenticated request to /api/v10/auth/me with 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v10/auth/me');
    expect(res.status).toBe(401);
  });

  it('should reject invalid registration payload with 400 Validation Error', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v10/auth/register')
      .send({
        email: 'invalid-email-format',
        password: '123', // too short
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  it('should serve SyncCord Web App HTML on GET / without ENOENT 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/')
      .set('Accept', 'text/html');
    expect(res.status).toBe(200);
    expect(res.text).toContain('SyncCord');
  });

  it('should return API metadata on GET / when requested as JSON', async () => {
    const res = await request(app.getHttpServer())
      .get('/')
      .set('Accept', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('SyncCord API & Web Client');
    expect(res.body.documentation).toBe('/api/docs');
  });
});
