import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
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

  @Get('microsoft/auth-url')
  @Roles(UserRole.ADMIN)
  getMicrosoftAuthUrl(@Query('redirectUri') redirectUri?: string) {
    return this.mailService.getMicrosoftAuthUrl(redirectUri);
  }

  @Post('microsoft/callback')
  @Roles(UserRole.ADMIN)
  microsoftCallback(@Body() body: { code: string; state?: string; redirectUri?: string }) {
    return this.mailService.connectMicrosoft(body.code, body.state, body.redirectUri);
  }

  @Post('microsoft/disconnect')
  @Roles(UserRole.ADMIN)
  disconnectMicrosoft() {
    return this.mailService.disconnectMicrosoft();
  }
}
