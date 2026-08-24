import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;

  const prismaMock = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);

    jest.clearAllMocks();
  });

  describe('updateOrderStatus', () => {
    it('should change PENDING to CONFIRMED', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
      });

      prismaMock.order.update.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.CONFIRMED,
      });

      const result = await service.updateOrderStatus('order-1', {
        status: OrderStatus.CONFIRMED,
      });

      expect(result.status).toBe(OrderStatus.CONFIRMED);

      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: {
          id: 'order-1',
        },
        data: {
          status: OrderStatus.CONFIRMED,
        },
      });
    });

    it('should reject an invalid status transition', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
      });

      await expect(
        service.updateOrderStatus('order-1', {
          status: OrderStatus.READY,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.order.update).not.toHaveBeenCalled();
    });

    it('should reject changing a completed order', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.COMPLETED,
      });

      await expect(
        service.updateOrderStatus('order-1', {
          status: OrderStatus.PREPARING,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.order.update).not.toHaveBeenCalled();
    });

    it('should throw when the order does not exist', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOrderStatus('missing-order', {
          status: OrderStatus.CONFIRMED,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prismaMock.order.update).not.toHaveBeenCalled();
    });
  });
});
