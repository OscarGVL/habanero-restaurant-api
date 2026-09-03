jest.mock('@nestjs/jwt', () => ({
  JwtService: class {
    signAsync = jest.fn();
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should login a customer', async () => {
    const loginDto = {
      email: 'customer@example.com',
      password: 'password123',
    };

    const response = {
      accessToken: 'access-token',
    };

    authServiceMock.login.mockResolvedValue(response);

    const result = await controller.login(loginDto);

    expect(result).toEqual(response);

    expect(authServiceMock.login).toHaveBeenCalledWith(loginDto);
  });
});
