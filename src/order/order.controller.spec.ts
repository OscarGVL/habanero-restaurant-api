import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderStatus, UserRole } from '../../generated/prisma/client';
import { Reflector } from '@nestjs/core';

describe('OrderController', () => {
  let controller: OrderController;

  const orderServiceMock = {
    createOrder: jest.fn(),
    getOrderById: jest.fn(),
    getCustomerOrderById: jest.fn(),
    getOrders: jest.fn(),
    getCustomerOrders: jest.fn(),
    updateOrderStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: OrderService,
          useValue: orderServiceMock,
        },
      ],
    }).compile();

    controller = module.get<OrderController>(OrderController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create an order for the authenticated customer', async () => {
    const request = {
      user: {
        customerId: 'customer-1',
        email: 'customer@example.com',
      },
    };

    const createOrderDto = {
      items: [
        {
          menuItemId: 'menu-1',
          quantity: 2,
        },
      ],
    };

    const order = {
      id: 'order-1',
      customerId: 'customer-1',
      total: 398,
    };

    orderServiceMock.createOrder.mockResolvedValue(order);

    const result = await controller.createOrder(request, createOrderDto);

    expect(result).toEqual(order);

    expect(orderServiceMock.createOrder).toHaveBeenCalledWith(
      'customer-1',
      createOrderDto,
    );
  });

  it('should return an order by id', async () => {
    const order = {
      id: 'order-1',
      customerId: 'customer-1',
      total: 398,
    };

    orderServiceMock.getOrderById.mockResolvedValue(order);

    const result = await controller.getOrderById('order-1');

    expect(result).toEqual(order);

    expect(orderServiceMock.getOrderById).toHaveBeenCalledWith('order-1');
  });

  it('should return an order by id owned by the customer', async () => {
    const request = {
      user: {
        customerId: 'customer-1',
        email: 'customer@example.com',
      },
    };

    const order = {
      id: 'order-1',
      customerId: 'customer-1',
      total: 398,
    };

    orderServiceMock.getCustomerOrderById.mockResolvedValue(order);

    const result = await controller.getCustomerOrderById('order-1', request);

    expect(result).toEqual(order);

    expect(orderServiceMock.getCustomerOrderById).toHaveBeenCalledWith(
      'order-1',
      'customer-1',
    );
  });

  it('should return orders with pagination and filters', async () => {
    const getOrdersDto = {
      page: 2,
      limit: 10,
      customerId: 'customer-1',
      status: OrderStatus.CONFIRMED,
    };

    const ordersResponse = {
      data: [
        {
          id: 'order-1',
          customerId: 'customer-1',
          status: OrderStatus.CONFIRMED,
          total: 398,
        },
      ],
      pagination: {
        page: 2,
        limit: 10,
        total: 15,
        totalPages: 2,
      },
    };

    orderServiceMock.getOrders.mockResolvedValue(ordersResponse);

    const result = await controller.getOrders(getOrdersDto);

    expect(result).toEqual(ordersResponse);

    expect(orderServiceMock.getOrders).toHaveBeenCalledWith(getOrdersDto);
  });

  it('should return orders with pagination and filters for a customer', async () => {
    const request = {
      user: {
        customerId: 'customer-1',
        email: 'customer@example.com',
      },
    };

    const getOrdersDto = {
      page: 2,
      limit: 10,
      customerId: 'customer-1',
      status: OrderStatus.CONFIRMED,
    };

    const ordersResponse = {
      data: [
        {
          id: 'order-1',
          customerId: 'customer-1',
          status: OrderStatus.CONFIRMED,
          total: 398,
        },
      ],
      pagination: {
        page: 2,
        limit: 10,
        total: 15,
        totalPages: 2,
      },
    };

    orderServiceMock.getCustomerOrders.mockResolvedValue(ordersResponse);

    const result = await controller.getCustomerOrders(request, getOrdersDto);

    expect(result).toEqual(ordersResponse);

    expect(orderServiceMock.getCustomerOrders).toHaveBeenCalledWith(
      'customer-1',
      getOrdersDto,
    );
  });

  it('should update an order status', async () => {
    const updateOrderStatusDto = {
      status: OrderStatus.CONFIRMED,
    };

    const updatedOrder = {
      id: 'order-1',
      customerId: 'customer-1',
      status: OrderStatus.CONFIRMED,
      total: 398,
    };

    orderServiceMock.updateOrderStatus.mockResolvedValue(updatedOrder);

    const result = await controller.updateOrderStatus(
      'order-1',
      updateOrderStatusDto,
    );

    expect(result).toEqual(updatedOrder);

    expect(orderServiceMock.updateOrderStatus).toHaveBeenCalledWith(
      'order-1',
      updateOrderStatusDto,
    );
  });

  it('should require the STAFF role to update an order status', () => {
    const reflector = new Reflector();

    const requiredRoles = reflector.getAllAndOverride<UserRole[]>('roles', [
      controller.updateOrderStatus,
      OrderController,
    ]);

    expect(requiredRoles).toEqual([UserRole.STAFF]);
  });
});
