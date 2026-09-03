import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { UserRole } from '../../../generated/prisma/client';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const configServiceMock = {
    getOrThrow: jest.fn().mockReturnValue('test-secret'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);

    jest.clearAllMocks();

    configServiceMock.getOrThrow.mockReturnValue('test-secret');
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should return the authenticated customer information', () => {
    const payload = {
      sub: 'customer-1',
      email: 'customer@example.com',
      role: UserRole.CUSTOMER,
    };

    const result = strategy.validate(payload);

    expect(result).toEqual({
      customerId: 'customer-1',
      email: 'customer@example.com',
    });
  });
});
