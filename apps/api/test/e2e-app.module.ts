import {
  CanActivate,
  Controller,
  Body,
  ExecutionContext,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoginDto } from '../src/modules/auth/dto/login.dto';

type TestUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  accessToken?: string;
};

@Injectable()
class TestSessionStore {
  private readonly sessions = new Map<string, TestUser>();

  set(token: string, user: TestUser) {
    this.sessions.set(token, user);
  }

  get(token: string) {
    return this.sessions.get(token);
  }
}

@Injectable()
class TestAuthGuard implements CanActivate {
  constructor(private readonly sessions: TestSessionStore) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (request.method === 'POST' && request.path === '/auth/login') {
      return true;
    }

    const authHeader = request.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      throw new UnauthorizedException('Unauthorized');
    }

    const user = this.sessions.get(token);
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    request.user = user;
    return true;
  }
}

@Controller('auth')
class TestAuthController {
  constructor(private readonly sessions: TestSessionStore) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    const email = dto.email.toLowerCase();
    const password = dto.password;

    const users: Record<string, TestUser & { password: string }> = {
      'admin@demo.com': {
        id: 'user-admin',
        email: 'admin@demo.com',
        name: 'Admin Demo',
        role: 'ADMIN',
        tenantId: 'tenant-demo',
        password: 'Demo@1234',
      },
      'employee@demo.com': {
        id: 'user-employee',
        email: 'employee@demo.com',
        name: 'Employee Demo',
        role: 'EMPLOYEE',
        tenantId: 'tenant-demo',
        password: 'Demo@1234',
      },
    };

    const user = users[email];
    if (!user || user.password !== password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = `test-token-${user.id}-${Date.now()}`;
    const sessionUser: TestUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      accessToken,
    };
    this.sessions.set(accessToken, sessionUser);

    return {
      data: {
        accessToken,
        user: sessionUser,
      },
    };
  }

  @Get('me')
  me(@Req() req: any) {
    return {
      data: req.user,
    };
  }
}

@Controller('delegation')
@UseGuards(TestAuthGuard)
class TestDelegationController {
  @Get()
  findAll() {
    return {
      data: {
        data: [],
        meta: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      },
    };
  }

  @Get('my-pending')
  findMyPending() {
    return {
      data: [],
    };
  }

  @Get(':id')
  findOne() {
    throw new NotFoundException('Delegation task not found');
  }
}

@Module({
  controllers: [TestAuthController, TestDelegationController],
  providers: [
    TestSessionStore,
    {
      provide: APP_GUARD,
      useClass: TestAuthGuard,
    },
  ],
})
export class E2eAppModule {}
