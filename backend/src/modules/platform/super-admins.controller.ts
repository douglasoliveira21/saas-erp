import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { SuperAdminsService } from './super-admins.service';
import { SuperAdminJwtAuthGuard } from './guards/super-admin-jwt-auth.guard';

@Controller('super-admin/admins')
@UseGuards(SuperAdminJwtAuthGuard)
export class SuperAdminsController {
  constructor(private readonly service: SuperAdminsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    if (id === req.user.id && body.active === false) {
      throw new BadRequestException('Você não pode desativar sua própria conta.');
    }
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    if (id === req.user.id) throw new BadRequestException('Você não pode remover sua própria conta.');
    return this.service.remove(id);
  }
}
