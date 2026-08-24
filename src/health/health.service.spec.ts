import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: {
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should return ok when the database is available', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.getHealth()).resolves.toEqual({
      status: 'ok',
      database: 'ok',
    });
  });

  it('should return error when the database is unavailable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('Database unavailable'));

    await expect(service.getHealth()).resolves.toEqual({
      status: 'error',
      database: 'error',
    });
  });
});
