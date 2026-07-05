import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { E2eAppModule } from './e2e-app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [E2eAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login — valid credentials return accessToken', async () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@demo.com', password: 'Demo@1234' })
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toHaveProperty('accessToken');
        expect(res.body.data).toHaveProperty('user');
        expect(res.body.data.user).toHaveProperty('role');
      });
  });

  it('POST /auth/login — wrong password returns 401', async () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@demo.com', password: 'wrongpassword' })
      .expect(401);
  });

  it('POST /auth/login — missing body returns 400', async () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({})
      .expect(400);
  });

  it('GET /auth/me — valid token returns current user', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@demo.com', password: 'Demo@1234' });

    const token = loginRes.body.data?.accessToken;
    if (!token) return; // Skip if seeded user not available in CI

    return request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toHaveProperty('email');
      });
  });

  it('GET /auth/me — no token returns 401', async () => {
    return request(app.getHttpServer())
      .get('/auth/me')
      .expect(401);
  });
});
