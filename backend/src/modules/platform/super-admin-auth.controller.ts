import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { SuperAdminJwtAuthGuard } from './guards/super-admin-jwt-auth.guard';

@Controller('super-admin/auth')
export class SuperAdminAuthController {
  constructor(private readonly authService: SuperAdminAuthService) {}

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('verify-code')
  verifyCode(@Body() body: { pendingToken: string; code: string }) {
    return this.authService.verifyCode(body.pendingToken, body.code);
  }

  @Post('resend-code')
  resendCode(@Body() body: { pendingToken: string }) {
    return this.authService.resendCode(body.pendingToken);
  }

  @UseGuards(SuperAdminJwtAuthGuard)
  @Get('me')
  me(@Request() req: any) {
    return req.user;
  }

  @UseGuards(SuperAdminJwtAuthGuard)
  @Post('change-password')
  changePassword(@Request() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }
}
