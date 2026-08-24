import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { MenuService } from './menu.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  getMenu() {
    return this.menuService.getMenu();
  }

  @Get(':id')
  getMenuItem(@Param('id') id: string) {
    return this.menuService.getMenuItem(id);
  }

  @Post()
  createMenuItem(@Body() createMenuItemDto: CreateMenuItemDto) {
    return this.menuService.createMenuItem(createMenuItemDto);
  }

  @Patch(':id')
  updateMenuItem(
    @Param('id') id: string,
    @Body() updateMenuItemDto: UpdateMenuItemDto,
  ) {
    return this.menuService.updateMenuItem(id, updateMenuItemDto);
  }

  @Delete(':id')
  deleteMenuItem(@Param('id') id: string) {
    return this.menuService.deleteMenuItem(id);
  }
}
