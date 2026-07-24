import { Controller, Post, Body, UseGuards, Get, Request, Response, Param, Delete } from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Response({ passthrough: true }) response: ExpressResponse, @Request() req) {
    const result = await this.authService.login(loginDto, { ip: req?.ip, userAgent: req?.headers?.['user-agent'], deviceName: req?.headers?.['x-device-name'] });
    response.cookie('access_token', result.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
    return { access_token: result.access_token, user: result.user };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('logout')
  async logout(@Response({ passthrough: true }) response: ExpressResponse, @Request() req) {
    await this.authService.logout(req.user?.id, req.user?.sessionId);
    response.clearCookie('access_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
    return { success: true };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('session')
  async getSession(@Request() req) {
    return { user: req.user || null };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('update-profile')
  async updateProfile(@Request() req, @Body() body: { name?: string; email?: string; password?: string; currentPassword?: string }) {
    return this.authService.updateProfile(req.user.id, body);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }, @Request() req) {
    return this.authService.forgotPassword(body.email, { ip: req.ip, userAgent: req.headers?.['user-agent'] });
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  sessions(@Request() req) { return this.authService.listSessions(req.user.id, req.user.sessionId); }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  revokeSession(@Request() req, @Param('id') id: string) { return this.authService.revokeSession(req.user.id, id); }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/revoke-others')
  revokeOthers(@Request() req) { return this.authService.revokeOtherSessions(req.user.id, req.user.sessionId); }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPassword(body.token, body.password);
  }
}
