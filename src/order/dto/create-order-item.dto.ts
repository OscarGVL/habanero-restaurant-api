import { IsInt, IsUUID, Min } from 'class-validator';

export class CreateOrderItemDto {
  @IsUUID()
  menuItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}
