jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    signAsync = jest.fn();
  },
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    customer: {
      findUnique: jest.fn(),
    },
  };

  const jwtServiceMock = {
    signAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should login a customer with valid credentials', async () => {
    const customer = {
      id: 'customer-1',
      email: 'customer@example.com',
      name: 'John Doe',
      passwordHash: 'hashed-password',
    };

    const loginDto = {
      email: 'customer@example.com',
      password: 'password123',
    };

    prismaMock.customer.findUnique.mockResolvedValue(customer);

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    jwtServiceMock.signAsync.mockResolvedValue('access-token');

    const result = await service.login(loginDto);

    expect(result).toEqual({
      accessToken: 'access-token',
    });

    expect(prismaMock.customer.findUnique).toHaveBeenCalledWith({
      where: {
        email: 'customer@example.com',
      },
    });

    expect(jwtServiceMock.signAsync).toHaveBeenCalledWith({
      sub: 'customer-1',
      email: 'customer@example.com',
    });
  });

  it('should reject login when the customer does not exist', async () => {
    const loginDto = {
      email: 'missing@example.com',
      password: 'password123',
    };

    prismaMock.customer.findUnique.mockResolvedValue(null);

    await expect(service.login(loginDto)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(prismaMock.customer.findUnique).toHaveBeenCalledWith({
      where: {
        email: 'missing@example.com',
      },
    });

    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });

  it('should reject login when the password is incorrect', async () => {
    const customer = {
      id: 'customer-1',
      email: 'customer@example.com',
      name: 'John Doe',
      passwordHash: 'hashed-password',
    };

    const loginDto = {
      email: 'customer@example.com',
      password: 'wrong-password',
    };

    prismaMock.customer.findUnique.mockResolvedValue(customer);

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login(loginDto)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(bcrypt.compare).toHaveBeenCalledWith(
      'wrong-password',
      'hashed-password',
    );

    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
  });
});
