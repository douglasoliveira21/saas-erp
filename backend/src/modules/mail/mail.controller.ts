import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { MailService } from './mail.service';

@Controller('mail')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('config')
  @Roles(UserRole.ADMIN)
  getConfig() {
    return this.mailService.getPublicConfig();
  }

  @Patch('config')
  @Roles(UserRole.ADMIN)
  updateConfig(@Body() body: any) {
    return this.mailService.updateConfig(body);
  }
}
