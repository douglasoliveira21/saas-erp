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

  @UseGuards(SuperAdminJwtAuthGuard)
  @Get('me')
  me(@Request() req: any) {
    return req.user;
  }
}
