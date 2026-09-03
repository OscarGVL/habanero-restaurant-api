import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;

  const prismaMock = {
    customer: {
      findUnique: jest.fn(),
    },
    menuItem: {
      findMany: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    orderItem: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
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

  describe('createOrder', () => {
    it('should create an order using menu item prices from the database', async () => {
      const customer = {
        id: 'customer-1',
      };

      const menuItems = [
        {
          id: 'menu-1',
          name: 'Burger',
          price: 199,
          available: true,
          deletedAt: null,
        },
      ];

      const createdOrder = {
        id: 'order-1',
        customerId: 'customer-1',
        total: 398,
      };

      const finalOrder = {
        ...createdOrder,
        items: [
          {
            orderId: 'order-1',
            menuItemId: 'menu-1',
            quantity: 2,
            unitPrice: 199,
          },
        ],
      };

      prismaMock.customer.findUnique.mockResolvedValue(customer);
      prismaMock.menuItem.findMany.mockResolvedValue(menuItems);

      const txOrderCreate = jest.fn().mockResolvedValue(createdOrder);
      const txOrderItemCreate = jest.fn().mockResolvedValue({
        orderId: 'order-1',
        menuItemId: 'menu-1',
        quantity: 2,
        unitPrice: 199,
      });
      const txOrderFindUnique = jest.fn().mockResolvedValue(finalOrder);

      prismaMock.$transaction.mockImplementation(
        async (
          callback: (tx: {
            order: {
              create: typeof txOrderCreate;
              findUnique: typeof txOrderFindUnique;
            };
            orderItem: {
              create: typeof txOrderItemCreate;
            };
          }) => Promise<unknown>,
        ) => {
          const tx = {
            order: {
              create: txOrderCreate,
              findUnique: txOrderFindUnique,
            },
            orderItem: {
              create: txOrderItemCreate,
            },
          };

          return callback(tx);
        },
      );

      const result = await service.createOrder('customer-1', {
        items: [
          {
            menuItemId: 'menu-1',
            quantity: 2,
          },
        ],
      });

      expect(result).toEqual(finalOrder);

      expect(prismaMock.customer.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'customer-1',
        },
      });

      expect(prismaMock.menuItem.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['menu-1'],
          },
          deletedAt: null,
        },
      });

      expect(txOrderCreate).toHaveBeenCalledWith({
        data: { customerId: 'customer-1', total: 398 },
      });
      expect(txOrderItemCreate).toHaveBeenCalledWith({
        data: {
          orderId: 'order-1',
          menuItemId: 'menu-1',
          quantity: 2,
          unitPrice: 199,
        },
      });
      expect(txOrderFindUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        include: { items: true },
      });
    });

    it('should throw when the customer does not exist', async () => {
      prismaMock.customer.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrder('missing-customer', {
          items: [
            {
              menuItemId: 'menu-1',
              quantity: 1,
            },
          ],
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prismaMock.customer.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'missing-customer',
        },
      });

      expect(prismaMock.menuItem.findMany).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('should throw when one or more menu items do not exist', async () => {
      prismaMock.customer.findUnique.mockResolvedValue({
        id: 'customer-1',
      });

      prismaMock.menuItem.findMany.mockResolvedValue([]);

      await expect(
        service.createOrder('customer-1', {
          items: [
            {
              menuItemId: 'missing-menu-item',
              quantity: 1,
            },
          ],
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prismaMock.menuItem.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['missing-menu-item'],
          },
          deletedAt: null,
        },
      });

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('should throw when a menu item is unavailable', async () => {
      prismaMock.customer.findUnique.mockResolvedValue({
        id: 'customer-1',
      });

      prismaMock.menuItem.findMany.mockResolvedValue([
        {
          id: 'menu-1',
          name: 'Burger',
          price: 199,
          available: false,
          deletedAt: null,
        },
      ]);

      await expect(
        service.createOrder('customer-1', {
          items: [
            {
              menuItemId: 'menu-1',
              quantity: 1,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('should combine quantities when the same menu item is included multiple times', async () => {
      const customer = {
        id: 'customer-1',
      };

      const menuItems = [
        {
          id: 'menu-1',
          name: 'Burger',
          price: 199,
          available: true,
          deletedAt: null,
        },
      ];

      const createdOrder = {
        id: 'order-1',
        customerId: 'customer-1',
        total: 995,
      };

      const finalOrder = {
        ...createdOrder,
        items: [
          {
            orderId: 'order-1',
            menuItemId: 'menu-1',
            quantity: 5,
            unitPrice: 199,
          },
        ],
      };

      prismaMock.customer.findUnique.mockResolvedValue(customer);
      prismaMock.menuItem.findMany.mockResolvedValue(menuItems);

      const txOrderCreate = jest.fn().mockResolvedValue(createdOrder);

      const txOrderItemCreate = jest.fn().mockResolvedValue({
        orderId: 'order-1',
        menuItemId: 'menu-1',
        quantity: 5,
        unitPrice: 199,
      });

      const txOrderFindUnique = jest.fn().mockResolvedValue(finalOrder);

      type TransactionMock = {
        order: {
          create: jest.Mock;
          findUnique: jest.Mock;
        };
        orderItem: {
          create: jest.Mock;
        };
      };

      const tx: TransactionMock = {
        order: {
          create: txOrderCreate,
          findUnique: txOrderFindUnique,
        },
        orderItem: {
          create: txOrderItemCreate,
        },
      };

      prismaMock.$transaction.mockImplementation(
        (callback: (tx: TransactionMock) => Promise<unknown>) => {
          return callback(tx);
        },
      );

      const result = await service.createOrder('customer-1', {
        items: [
          {
            menuItemId: 'menu-1',
            quantity: 2,
          },
          {
            menuItemId: 'menu-1',
            quantity: 3,
          },
        ],
      });

      expect(result).toEqual(finalOrder);

      expect(prismaMock.menuItem.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['menu-1'],
          },
          deletedAt: null,
        },
      });

      expect(txOrderCreate).toHaveBeenCalledWith({
        data: {
          customerId: 'customer-1',
          total: 995,
        },
      });

      expect(txOrderItemCreate).toHaveBeenCalledWith({
        data: {
          orderId: 'order-1',
          menuItemId: 'menu-1',
          quantity: 5,
          unitPrice: 199,
        },
      });

      expect(txOrderItemCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOrderById', () => {
    it('should return an order with its items and menu items', async () => {
      const order = {
        id: 'order-1',
        customerId: 'customer-1',
        status: OrderStatus.PENDING,
        total: 398,
        items: [
          {
            id: 'order-item-1',
            orderId: 'order-1',
            menuItemId: 'menu-1',
            quantity: 2,
            unitPrice: 199,
            menuItem: {
              id: 'menu-1',
              name: 'Burger',
              price: 199,
              available: true,
              deletedAt: null,
            },
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(order);

      const result = await service.getOrderById('order-1');

      expect(result).toEqual(order);

      expect(prismaMock.order.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'order-1',
        },
        include: {
          items: {
            include: {
              menuItem: true,
            },
          },
        },
      });
    });

    it('should throw when the order does not exist', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(service.getOrderById('missing-order')).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaMock.order.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'missing-order',
        },
        include: {
          items: {
            include: {
              menuItem: true,
            },
          },
        },
      });
    });
  });

  describe('getCustomerOrderById', () => {
    it('should return an order with its items and menu items', async () => {
      const order = {
        id: 'order-1',
        customerId: 'customer-1',
        status: OrderStatus.PENDING,
        total: 398,
        items: [
          {
            id: 'order-item-1',
            orderId: 'order-1',
            menuItemId: 'menu-1',
            quantity: 2,
            unitPrice: 199,
            menuItem: {
              id: 'menu-1',
              name: 'Burger',
              price: 199,
              available: true,
              deletedAt: null,
            },
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(order);

      const result = await service.getCustomerOrderById(
        'order-1',
        'customer-1',
      );

      expect(result).toEqual(order);

      expect(prismaMock.order.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'order-1',
        },
        include: {
          items: {
            include: {
              menuItem: true,
            },
          },
        },
      });
    });

    it('should throw when the order does not exist', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        service.getCustomerOrderById('missing-order', 'customer-1'),
      ).rejects.toThrow(NotFoundException);

      expect(prismaMock.order.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'missing-order',
        },
        include: {
          items: {
            include: {
              menuItem: true,
            },
          },
        },
      });
    });

    it('should throw when the customer does not own the order', async () => {
      const order = {
        id: 'order-1',
        customerId: 'customer-1',
        status: OrderStatus.PENDING,
        total: 398,
        items: [
          {
            id: 'order-item-1',
            orderId: 'order-1',
            menuItemId: 'menu-1',
            quantity: 2,
            unitPrice: 199,
            menuItem: {
              id: 'menu-1',
              name: 'Burger',
              price: 199,
              available: true,
              deletedAt: null,
            },
          },
        ],
      };

      prismaMock.order.findUnique.mockResolvedValue(order);

      await expect(
        service.getCustomerOrderById('order-1', 'customer-2'),
      ).rejects.toThrow(ForbiddenException);

      expect(prismaMock.order.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'order-1',
        },
        include: {
          items: {
            include: {
              menuItem: true,
            },
          },
        },
      });
    });
  });

  describe('getOrders', () => {
    it('should return paginated orders', async () => {
      const orders = [
        {
          id: 'order-1',
          customerId: 'customer-1',
          status: OrderStatus.PENDING,
          total: 398,
          items: [],
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(orders);
      prismaMock.order.count.mockResolvedValue(25);

      prismaMock.$transaction.mockResolvedValue([orders, 25]);

      const result = await service.getOrders({
        page: 2,
        limit: 10,
      });

      expect(result).toEqual({
        data: orders,
        pagination: {
          page: 2,
          limit: 10,
          total: 25,
          totalPages: 3,
        },
      });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 10,
        take: 10,
        include: {
          items: {
            include: {
              menuItem: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(prismaMock.order.count).toHaveBeenCalledWith({
        where: {},
      });
    });

    it('should filter orders by customer and status', async () => {
      const orders = [
        {
          id: 'order-1',
          customerId: 'customer-1',
          status: OrderStatus.CONFIRMED,
          total: 398,
          items: [],
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(orders);
      prismaMock.order.count.mockResolvedValue(1);

      prismaMock.$transaction.mockResolvedValue([orders, 1]);

      const result = await service.getOrders({
        page: 1,
        limit: 10,
        customerId: 'customer-1',
        status: OrderStatus.CONFIRMED,
      });

      expect(result).toEqual({
        data: orders,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });

      const expectedWhere = {
        customerId: 'customer-1',
        status: OrderStatus.CONFIRMED,
      };

      expect(prismaMock.order.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        skip: 0,
        take: 10,
        include: {
          items: {
            include: {
              menuItem: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(prismaMock.order.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });

    it('should use default pagination values', async () => {
      const orders = [
        {
          id: 'order-1',
          customerId: 'customer-1',
          status: OrderStatus.PENDING,
          total: 398,
          items: [],
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(orders);
      prismaMock.order.count.mockResolvedValue(1);

      prismaMock.$transaction.mockResolvedValue([orders, 1]);

      const result = await service.getOrders({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual({
        data: orders,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        include: {
          items: {
            include: {
              menuItem: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(prismaMock.order.count).toHaveBeenCalledWith({
        where: {},
      });
    });
  });

  describe('getCustomerOrders', () => {
    it('should return orders for the authenticated customer', async () => {
      const getOrdersDto = {
        page: 1,
        limit: 10,
      };

      const ordersResponse = {
        data: [
          {
            id: 'order-1',
            customerId: 'customer-1',
            total: 398,
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      const getOrdersSpy = jest
        .spyOn(service, 'getOrders')
        .mockResolvedValue(ordersResponse as never);

      const result = await service.getCustomerOrders(
        'customer-1',
        getOrdersDto,
      );

      expect(result).toEqual(ordersResponse);

      expect(getOrdersSpy).toHaveBeenCalledWith({
        ...getOrdersDto,
        customerId: 'customer-1',
      });
    });
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
