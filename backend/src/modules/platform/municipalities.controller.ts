import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { MunicipalitiesService } from './municipalities.service';
import { SuperAdminJwtAuthGuard } from './guards/super-admin-jwt-auth.guard';

@Controller('super-admin/municipalities')
@UseGuards(SuperAdminJwtAuthGuard)
export class MunicipalitiesController {
  constructor(private readonly service: MunicipalitiesService) {}

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
