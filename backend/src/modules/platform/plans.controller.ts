import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PlansService } from './plans.service';
import { SuperAdminJwtAuthGuard } from './guards/super-admin-jwt-auth.guard';

@Controller('super-admin/plans')
@UseGuards(SuperAdminJwtAuthGuard)
export class PlansController {
  constructor(private readonly service: PlansService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
