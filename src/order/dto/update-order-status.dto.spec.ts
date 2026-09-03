import { validate } from 'class-validator';
import { OrderStatus } from '../../../generated/prisma/client';
import { UpdateOrderStatusDto } from './update-order-status.dto';

describe('UpdateOrderStatusDto', () => {
  it('should accept a valid order status', async () => {
    const dto = new UpdateOrderStatusDto();

    dto.status = OrderStatus.CONFIRMED;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid order status', async () => {
    const dto = new UpdateOrderStatusDto();

    dto.status = 'BANANA' as OrderStatus;

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });
});
