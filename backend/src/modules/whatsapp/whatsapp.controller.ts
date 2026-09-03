import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class WhatsappController {
  constructor(private readonly service: WhatsappService) {}

  @Get('config')
  getConfig() {
    return this.service.getPublicConfig();
  }

  @Patch('config')
  updateConfig(@Body() body: any) {
    return this.service.updateConfig(body);
  }

  @Get('qrcode')
  getQrCode() {
    return this.service.getQrCode();
  }

  @Post('test-connection')
  testConnection() {
    return this.service.checkConnectionStatus();
  }

  @Post('disconnect')
  disconnect() {
    return this.service.disconnectInstance();
  }

  @Get('logs')
  getLogs(@Query('limit') limit?: string) {
    return this.service.listLogs(limit ? Number(limit) : undefined);
  }
}
