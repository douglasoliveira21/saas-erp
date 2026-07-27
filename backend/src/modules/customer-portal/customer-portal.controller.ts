import { Body, Controller, Get, Param, Patch, Post, Request, Response, UseGuards } from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import { CustomerPortalService } from './customer-portal.service';
import { PortalAuthGuard } from './portal-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('portal')
export class CustomerPortalController {
  constructor(private service: CustomerPortalService) {}
  @Post('public/company') company(@Body() body: any) { return this.service.findCompany(body.cnpj); }
  @Post('public/register') register(@Body() body: any) { return this.service.selfRegister(body); }
  @Post('public/login') async login(@Body() body: any, @Response({ passthrough: true }) response: ExpressResponse) {
    const result = await this.service.login(body.email, body.password);
    response.cookie('portal_token', result.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 604800000, path: '/api/portal' });
    return result;
  }
  @Post('public/logout') logout(@Response({ passthrough: true }) response: ExpressResponse) {
    response.clearCookie('portal_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/portal' });
    return { success: true };
  }
  @Get('me') @UseGuards(PortalAuthGuard) me(@Request() req) { return this.service.me(req.portalUser.sub); }
  @Get('dashboard') @UseGuards(PortalAuthGuard) dashboard(@Request() req) { return this.service.dashboard(req.portalUser); }
  @Get('form') @UseGuards(PortalAuthGuard) form(@Request() req) { return this.service.getForm(req.portalUser.customerId); }
  @Get('tickets') @UseGuards(PortalAuthGuard) tickets(@Request() req) { return this.service.listTickets(req.portalUser); }
  @Post('tickets') @UseGuards(PortalAuthGuard) createTicket(@Request() req, @Body() body: any) { return this.service.createTicket(req.portalUser, body); }
  @Get('documents') @UseGuards(PortalAuthGuard) documents(@Request() req) { return this.service.documents(req.portalUser); }
  @Get('users') @UseGuards(PortalAuthGuard) users(@Request() req) { return this.service.listUsers(req.portalUser); }
  @Post('users') @UseGuards(PortalAuthGuard) createUser(@Request() req, @Body() body: any) { return this.service.createUser(body, req.portalUser.sub, req.portalUser); }
  @Patch('users/:id') @UseGuards(PortalAuthGuard) updateUser(@Request() req, @Param('id') id: string, @Body() body: any) { return this.service.updateUser(id, body, req.portalUser.sub, req.portalUser); }

  @Get('admin/users') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN)
  adminUsers() { return this.service.listUsers(); }
  @Post('admin/users') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN)
  adminCreate(@Request() req, @Body() body: any) { return this.service.createUser(body, req.user.id); }
  @Patch('admin/users/:id') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN)
  adminUpdate(@Request() req, @Param('id') id: string, @Body() body: any) { return this.service.updateUser(id, body, req.user.id); }
  @Post('admin/forms') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN)
  saveForm(@Body() body: any) { return this.service.saveForm(body); }
}
