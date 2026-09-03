import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { SuperAdminJwtAuthGuard } from './guards/super-admin-jwt-auth.guard';
import { UsersService } from '../users/users.service';

@Controller('super-admin/tenants')
@UseGuards(SuperAdminJwtAuthGuard)
export class TenantsController {
  constructor(
    private readonly service: TenantsService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Precisa vir antes de "@Get(':id')" para não ser interpretado como um id de tenant.
  @Get('dashboard/summary')
  getDashboard() {
    return this.service.getDashboard();
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

  // Exclusão permanente do tenant e de todos os seus dados — irreversível. O service exige
  // confirmName === tenant.name como segunda checagem, além do que a tela já pede ao operador.
  @Delete(':id')
  remove(@Param('id') id: string, @Body() body: { confirmName?: string }) {
    return this.service.remove(id, body?.confirmName || '');
  }

  // ==================== Usuários do tenant ====================
  // O super admin não tem papel de tenant (nem senha visível a ele) — a hash de senha nunca
  // sai daqui, mesmo que já vazasse na tela normal de usuários do próprio tenant.

  @Get(':id/users')
  async listUsers(@Param('id') id: string) {
    const users = await this.usersService.findAllByTenant(id);
    return users.map(({ password, ...rest }) => rest);
  }

  @Patch(':id/users/:userId')
  async updateUser(@Param('id') id: string, @Param('userId') userId: string, @Body() body: any) {
    const { password, ...rest } = await this.usersService.updateInTenant(id, userId, body);
    return rest;
  }

  @Delete(':id/users/:userId')
  async removeUser(@Param('id') id: string, @Param('userId') userId: string) {
    await this.usersService.removeInTenant(id, userId);
    return { success: true };
  }
}
