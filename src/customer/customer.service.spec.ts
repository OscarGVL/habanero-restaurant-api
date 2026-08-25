import { Test, TestingModule } from '@nestjs/testing';
import { CustomerService } from './customer.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

let prisma: {
  customer: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

describe('CustomerService', () => {
  let service: CustomerService;

  beforeEach(async () => {
    prisma = {
      customer: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a customer with a hashed password', async () => {
    const createCustomerDto = {
      email: 'john@example.com',
      name: 'John',
      password: 'password123',
    };

    const customer = {
      id: '1',
      email: 'john@example.com',
      name: 'John',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    prisma.customer.create.mockResolvedValue(customer);

    const result = await service.createCustomer(createCustomerDto);

    expect(result).toEqual(customer);

    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);

    expect(prisma.customer.create).toHaveBeenCalledWith({
      data: {
        email: 'john@example.com',
        name: 'John',
        passwordHash: 'hashed-password',
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('should throw ConflictException when the email is already registered', async () => {
    const createCustomerDto = {
      email: 'john@example.com',
      name: 'John',
      password: 'password123',
    };

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '7.9.1',
      },
    );

    prisma.customer.create.mockRejectedValue(prismaError);

    await expect(service.createCustomer(createCustomerDto)).rejects.toThrow(
      ConflictException,
    );

    expect(prisma.customer.create).toHaveBeenCalled();
  });

  it('should return customers without password hashes', async () => {
    const customers = [
      {
        id: '1',
        email: 'john@example.com',
        name: 'John',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    prisma.customer.findMany.mockResolvedValue(customers);

    const result = await service.getCustomers();

    expect(result).toEqual(customers);

    expect(prisma.customer.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('should return a customer by id', async () => {
    const customer = {
      id: '1',
      email: 'john@example.com',
      name: 'John',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma.customer.findUnique.mockResolvedValue(customer);

    const result = await service.getCustomer('1');

    expect(result).toEqual(customer);

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: {
        id: '1',
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('should throw when the customer does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(service.getCustomer('1')).rejects.toThrow(NotFoundException);

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: {
        id: '1',
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('should update a customer', async () => {
    const existingCustomer = {
      id: '1',
      email: 'old@example.com',
      name: 'John',
      passwordHash: 'existing-hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedCustomer = {
      id: '1',
      email: 'new@example.com',
      name: 'John Updated',
      createdAt: existingCustomer.createdAt,
      updatedAt: new Date(),
    };

    prisma.customer.findUnique.mockResolvedValue(existingCustomer);
    prisma.customer.update.mockResolvedValue(updatedCustomer);

    const result = await service.updateCustomer('1', {
      email: 'new@example.com',
      name: 'John Updated',
    });

    expect(result).toEqual(updatedCustomer);

    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: {
        id: '1',
      },
      data: {
        email: 'new@example.com',
        name: 'John Updated',
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('should hash a new password when updating a customer', async () => {
    const existingCustomer = {
      id: '1',
      email: 'john@example.com',
      name: 'John',
      passwordHash: 'old-hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedCustomer = {
      id: '1',
      email: 'john@example.com',
      name: 'John',
      createdAt: existingCustomer.createdAt,
      updatedAt: new Date(),
    };

    prisma.customer.findUnique.mockResolvedValue(existingCustomer);
    prisma.customer.update.mockResolvedValue(updatedCustomer);

    (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

    const result = await service.updateCustomer('1', {
      password: 'newpassword123',
    });

    expect(result).toEqual(updatedCustomer);

    expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 12);

    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: {
        id: '1',
      },
      data: {
        passwordHash: 'new-hashed-password',
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('should throw when updating a customer that does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(
      service.updateCustomer('1', {
        name: 'John Updated',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when updating to an email that is already registered', async () => {
    const existingCustomer = {
      id: '1',
      email: 'john@example.com',
      name: 'John',
      passwordHash: 'existing-hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma.customer.findUnique.mockResolvedValue(existingCustomer);

    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '7.9.1',
      },
    );

    prisma.customer.update.mockRejectedValue(prismaError);

    await expect(
      service.updateCustomer('1', {
        email: 'another@example.com',
      }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.customer.update).toHaveBeenCalled();
  });
});
