import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../../generated/prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { GetOrdersDto } from './dto/get-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(customerId: string, createOrderDto: CreateOrderDto) {
    const customer = await this.prisma.customer.findUnique({
      where: {
        id: customerId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const itemQuantities = new Map<string, number>();

    for (const item of createOrderDto.items) {
      const currentQuantity = itemQuantities.get(item.menuItemId) ?? 0;

      itemQuantities.set(item.menuItemId, currentQuantity + item.quantity);
    }

    const menuItemIds = [...itemQuantities.keys()];

    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: {
          in: menuItemIds,
        },
        deletedAt: null,
      },
    });

    if (menuItems.length !== menuItemIds.length) {
      throw new NotFoundException('One or more menu items not found');
    }

    let total = 0;

    for (const menuItem of menuItems) {
      if (!menuItem.available) {
        throw new BadRequestException(
          `Menu item "${menuItem.name}" is currently unavailable`,
        );
      }

      const quantity = itemQuantities.get(menuItem.id)!;

      total += Number(menuItem.price) * quantity;
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          customerId,
          total,
        },
      });

      for (const menuItem of menuItems) {
        const quantity = itemQuantities.get(menuItem.id)!;

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            menuItemId: menuItem.id,
            quantity,
            unitPrice: menuItem.price,
          },
        });
      }

      return tx.order.findUnique({
        where: {
          id: order.id,
        },
        include: {
          items: true,
        },
      });
    });
  }

  async getOrderById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id,
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async getCustomerOrderById(id: string, customerId: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id,
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('You are not allowed to access this order');
    }

    return order;
  }

  async getOrders(getOrdersDto: GetOrdersDto) {
    const { page, limit, customerId, status } = getOrdersDto;
    const skip = (page - 1) * limit;

    const where = {
      ...(customerId && { customerId }),
      ...(status && { status }),
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
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
      }),
      this.prisma.order.count({
        where,
      }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCustomerOrders(customerId: string, getOrdersDto: GetOrdersDto) {
    return this.getOrders({
      ...getOrdersDto,
      customerId,
    });
  }

  async updateOrderStatus(
    id: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: {
        id,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const allowedStatuses = allowedTransitions[order.status];

    if (!allowedStatuses.includes(updateOrderStatusDto.status)) {
      throw new BadRequestException(
        `Cannot change order status from ${order.status} to ${updateOrderStatusDto.status}`,
      );
    }

    return this.prisma.order.update({
      where: {
        id,
      },
      data: {
        status: updateOrderStatusDto.status,
      },
    });
  }
}
