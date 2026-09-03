import {
  Body,
  Controller,
  Get,
  Query,
  Param,
  Post,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderService } from './order.service';
import { GetOrdersDto } from './dto/get-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../../generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createOrder(
    @Request() request: { user: { customerId: string; email: string } },
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.orderService.createOrder(
      request.user.customerId,
      createOrderDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('customers/me/orders/:id')
  getCustomerOrderById(
    @Param('id') id: string,
    @Request() request: { user: { customerId: string; email: string } },
  ) {
    return this.orderService.getCustomerOrderById(id, request.user.customerId);
  }

  @Get(':id')
  getOrderById(@Param('id') id: string) {
    return this.orderService.getOrderById(id);
  }

  @Get()
  getOrders(@Query() getOrdersDto: GetOrdersDto) {
    return this.orderService.getOrders(getOrdersDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('customers/me/orders')
  getCustomerOrders(
    @Request() request: { user: { customerId: string; email: string } },
    @Query() getOrdersDto: GetOrdersDto,
  ) {
    return this.orderService.getCustomerOrders(
      request.user.customerId,
      getOrdersDto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF)
  @Patch(':id/status')
  updateOrderStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateOrderStatus(id, updateOrderStatusDto);
  }
}
