import { Body, Controller, Get, Param, Patch, Post, Request, Response, Res, UseGuards } from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import { CustomerPortalService } from './customer-portal.service';
import { PortalAuthGuard } from './portal-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { PortalNotificationsService } from './portal-notifications.service';
import { PlanGuard } from '../platform/guards/plan.guard';
import { RequireModule } from '../platform/decorators/require-module.decorator';

@Controller('portal')
export class CustomerPortalController {
  constructor(private service: CustomerPortalService, private notifications: PortalNotificationsService) {}
  @Post('public/company') company(@Body() body: any) { return this.service.findCompany(body.cnpj); }
  @Post('public/register') register(@Body() body: any) { return this.service.selfRegister(body); }
  @Post('public/verify-email') verifyEmail(@Body() body: any) { return this.service.verifyEmail(body.email, body.code); }
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
  @Get('notifications/public-key') @UseGuards(PortalAuthGuard) pushKey() { return this.notifications.getPublicKey(); }
  @Post('notifications/subscribe') @UseGuards(PortalAuthGuard) subscribe(@Request() req, @Body() body: any) { return this.notifications.subscribe(req.portalUser.sub, body); }
  @Get('notifications') @UseGuards(PortalAuthGuard) notificationsList(@Request() req) { return this.notifications.list(req.portalUser.sub); }
  @Patch('notifications/:id/read') @UseGuards(PortalAuthGuard) notificationRead(@Request() req, @Param('id') id: string) { return this.notifications.read(req.portalUser.sub, id); }
  @Get('dashboard') @UseGuards(PortalAuthGuard) dashboard(@Request() req) { return this.service.dashboard(req.portalUser); }
  @Get('form') @UseGuards(PortalAuthGuard) form(@Request() req) { return this.service.getForm(req.portalUser.customerId); }
  @Get('tickets') @UseGuards(PortalAuthGuard) tickets(@Request() req) { return this.service.listTickets(req.portalUser); }
  @Get('tickets/:glpiId') @UseGuards(PortalAuthGuard) ticketDetails(@Request() req, @Param('glpiId') glpiId: string) { return this.service.ticketDetails(req.portalUser, Number(glpiId)); }
  @Post('tickets') @UseGuards(PortalAuthGuard) createTicket(@Request() req, @Body() body: any) { return this.service.createTicket(req.portalUser, body); }
  @Get('documents') @UseGuards(PortalAuthGuard) documents(@Request() req) { return this.service.documents(req.portalUser); }
  @Get('documents/boletos/:id/pdf') @UseGuards(PortalAuthGuard)
  async boletoPdf(@Request() req, @Param('id') id: string, @Res() res: ExpressResponse) {
    const pdf = await this.service.boletoPdf(req.portalUser, id);
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename="boleto-${id}.pdf"`); res.send(pdf);
  }
  @Get('documents/invoices/:id') @UseGuards(PortalAuthGuard)
  invoiceDocument(@Request() req, @Param('id') id: string) { return this.service.invoiceDocument(req.portalUser, id); }
  @Get('documents/invoices/:id/xml') @UseGuards(PortalAuthGuard)
  async invoiceXml(@Request() req, @Param('id') id: string, @Res() res: ExpressResponse) {
    const file = await this.service.invoiceXml(req.portalUser, id); res.setHeader('Content-Type', 'application/xml'); res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`); res.send(file.content);
  }
  @Get('documents/invoices/:id/pdf') @UseGuards(PortalAuthGuard)
  async invoicePdf(@Request() req, @Param('id') id: string, @Res() res: ExpressResponse) {
    const file = await this.service.invoicePdf(req.portalUser, id); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`); res.send(file.content);
  }
  @Get('users') @UseGuards(PortalAuthGuard) users(@Request() req) { return this.service.listUsers(req.portalUser); }
  @Post('users') @UseGuards(PortalAuthGuard) createUser(@Request() req, @Body() body: any) { return this.service.createUser(body, req.portalUser.sub, req.portalUser); }
  @Patch('users/:id') @UseGuards(PortalAuthGuard) updateUser(@Request() req, @Param('id') id: string, @Body() body: any) { return this.service.updateUser(id, body, req.portalUser.sub, req.portalUser); }

  @Get('admin/users') @UseGuards(JwtAuthGuard, RolesGuard, PlanGuard) @Roles(UserRole.ADMIN) @RequireModule('customer_portal')
  adminUsers() { return this.service.listUsers(); }
  @Post('admin/users') @UseGuards(JwtAuthGuard, RolesGuard, PlanGuard) @Roles(UserRole.ADMIN) @RequireModule('customer_portal')
  adminCreate(@Request() req, @Body() body: any) { return this.service.createUser(body, req.user.id); }
  @Patch('admin/users/:id') @UseGuards(JwtAuthGuard, RolesGuard, PlanGuard) @Roles(UserRole.ADMIN) @RequireModule('customer_portal')
  adminUpdate(@Request() req, @Param('id') id: string, @Body() body: any) { return this.service.updateUser(id, body, req.user.id); }
  @Post('admin/forms') @UseGuards(JwtAuthGuard, RolesGuard, PlanGuard) @Roles(UserRole.ADMIN) @RequireModule('customer_portal')
  saveForm(@Body() body: any) { return this.service.saveForm(body); }
}
