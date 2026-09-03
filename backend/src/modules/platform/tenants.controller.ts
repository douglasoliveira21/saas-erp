import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { SuperAdminJwtAuthGuard } from './guards/super-admin-jwt-auth.guard';

@Controller('super-admin/tenants')
@UseGuards(SuperAdminJwtAuthGuard)
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

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
}
