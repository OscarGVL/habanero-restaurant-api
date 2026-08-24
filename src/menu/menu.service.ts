import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async getMenu() {
    return this.prisma.menuItem.findMany({
      where: {
        deletedAt: null,
      },
    });
  }

  async getMenuItem(id: string) {
    const menuItem = await this.prisma.menuItem.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    return menuItem;
  }

  async createMenuItem(createMenuItemDto: CreateMenuItemDto) {
    return this.prisma.menuItem.create({
      data: createMenuItemDto,
    });
  }

  async updateMenuItem(id: string, updateMenuItemDto: UpdateMenuItemDto) {
    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    return this.prisma.menuItem.update({
      where: { id },
      data: updateMenuItemDto,
    });
  }

  async deleteMenuItem(id: string) {
    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    return this.prisma.menuItem.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async deleteMenuItemFromDB(id: string) {
    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id },
    });

    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    return this.prisma.menuItem.delete({
      where: { id },
    });
  }
}
