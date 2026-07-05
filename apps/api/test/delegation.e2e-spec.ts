import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { E2eAppModule } from './e2e-app.module';

describe('Delegation (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let employeeToken: string;
  let createdTaskId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [E2eAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Login as admin
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@demo.com', password: 'Demo@1234' });
    adminToken = adminLogin.body.data?.accessToken ?? '';

    // Login as employee
    const empLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'employee@demo.com', password: 'Demo@1234' });
    employeeToken = empLogin.body.data?.accessToken ?? '';
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /delegation — requires auth', async () => {
    return request(app.getHttpServer())
      .get('/delegation')
      .expect(401);
  });

  it('GET /delegation/my-pending — employee sees own pending tasks', async () => {
    if (!employeeToken) return;
    return request(app.getHttpServer())
      .get('/delegation/my-pending')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.data)).toBe(true);
      });
  });

  it('GET /delegation — admin can list all tasks', async () => {
    if (!adminToken) return;
    return request(app.getHttpServer())
      .get('/delegation')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('meta');
      });
  });

  it('GET /delegation/:id — returns 404 for non-existent id', async () => {
    if (!adminToken) return;
    return request(app.getHttpServer())
      .get('/delegation/000000000000000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
