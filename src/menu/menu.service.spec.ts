import { Test, TestingModule } from '@nestjs/testing';
import { MenuService } from './menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('MenuService', () => {
  let service: MenuService;
  let prisma: {
    menuItem: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      menuItem: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<MenuService>(MenuService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return only non-deleted menu items', async () => {
    const menuItems = [
      {
        id: '1',
        name: 'Burger',
        price: 199,
        available: true,
        deletedAt: null,
      },
    ];

    prisma.menuItem.findMany.mockResolvedValue(menuItems);

    await expect(service.getMenu()).resolves.toEqual(menuItems);

    expect(prisma.menuItem.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
      },
    });
  });

  it('should soft delete an existing menu item', async () => {
    const menuItem = {
      id: '1',
      name: 'Burger',
      price: 199,
      available: true,
      deletedAt: null,
    };

    prisma.menuItem.findUnique.mockResolvedValue(menuItem);
    const deletedAt = new Date();
    const deletedMenuItem = {
      ...menuItem,
      deletedAt,
    };

    prisma.menuItem.update.mockResolvedValue(deletedMenuItem);

    const result = await service.deleteMenuItem('1');

    expect(result).toEqual(deletedMenuItem);

    expect(prisma.menuItem.update).toHaveBeenCalledWith({
      where: {
        id: '1',
      },
      data: {
        deletedAt,
      },
    });
  });

  it('should throw when deleting a menu item that does not exist', async () => {
    prisma.menuItem.findUnique.mockResolvedValue(null);

    await expect(service.deleteMenuItem('1')).rejects.toThrow(
      NotFoundException,
    );

    expect(prisma.menuItem.update).not.toHaveBeenCalled();
  });

  it('should return an active menu item', async () => {
    const menuItem = {
      id: '1',
      name: 'Burger',
      price: 199,
      available: true,
      deletedAt: null,
    };

    prisma.menuItem.findFirst.mockResolvedValue(menuItem);

    const result = await service.getMenuItem('1');

    expect(result).toEqual(menuItem);

    expect(prisma.menuItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: '1',
        deletedAt: null,
      },
    });
  });

  it('should throw when getting a deleted or nonexistent menu item', async () => {
    prisma.menuItem.findFirst.mockResolvedValue(null);

    await expect(service.getMenuItem('1')).rejects.toThrow(NotFoundException);
  });

  it('should return menu items even when they are unavailable', async () => {
    const menuItems = [
      {
        id: '1',
        name: 'Burger',
        price: 199,
        available: false,
        deletedAt: null,
      },
    ];

    prisma.menuItem.findMany.mockResolvedValue(menuItems);

    const result = await service.getMenu();

    expect(result).toEqual(menuItems);

    expect(prisma.menuItem.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
      },
    });
  });
});
