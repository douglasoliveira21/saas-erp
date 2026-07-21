import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { OperationsService } from './operations.service';

@Controller('operations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
export class OperationsController {
  constructor(private service: OperationsService) {}
  @Get('search') search(@Query('q') q: string) { return this.service.search(q); }
  @Get('data-quality') quality() { return this.service.dataQuality(); }
  @Get('approvals') approvals() { return this.service.list('approval_requests'); }
  @Post('approvals') approval(@Body() b:any,@Request() r:any) { return this.service.create('approval_requests',{...b,requested_by:r.user.id},r.user.id,'approval.requested'); }
  @Post('approvals/:id/review') review(@Param('id') id:string,@Body() b:any,@Request() r:any) { return this.service.approve(id,r.user.id,b.rejectReason); }
  @Get('collections') collections() { return this.service.list('collection_cases'); }
  @Post('collections') collection(@Body() b:any,@Request() r:any) { return this.service.create('collection_cases',{...b,created_by:r.user.id},r.user.id,'collection.created'); }
  @Patch('collections/:id') updateCollection(@Param('id') id:string,@Body() b:any,@Request() r:any) { return this.service.updateCase(id,b,r.user.id); }
  @Get('fiscal-closings') closings() { return this.service.list('fiscal_closings','period DESC'); }
  @Post('fiscal-closings') closing(@Body() b:any,@Request() r:any) { return this.service.create('fiscal_closings',{...b,closed_by:r.user.id},r.user.id,'fiscal.period_closed'); }
  @Get('allocations') allocations() { return this.service.list('cost_allocations'); }
  @Post('allocations') allocation(@Body() b:any,@Request() r:any) { return this.service.create('cost_allocations',{...b,created_by:r.user.id},r.user.id,'cost.allocation_created'); }
  @Get('cnab') cnab() { return this.service.list('cnab_batches'); }
  @Post('cnab') cnabCreate(@Body() b:any,@Request() r:any) { return this.service.create('cnab_batches',{...b,created_by:r.user.id},r.user.id,'cnab.received'); }
  @Get('notifications')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO, UserRole.TECNICO)
  notifications(@Request() r:any) { return this.service.notifications(r.user.id,r.user.role); }
  @Post('notifications') notification(@Body() b:any,@Request() r:any) { return this.service.create('notifications',b,r.user.id,'notification.created'); }
  @Patch('notifications/read-all')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO, UserRole.TECNICO)
  readAllNotifications(@Request() r:any) { return this.service.markAllNotificationsRead(r.user.id,r.user.role); }
  @Patch('notifications/:id/:action')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO, UserRole.TECNICO)
  notificationAction(@Param('id') id:string,@Param('action') action:string,@Body() b:any,@Request() r:any) { return this.service.updateNotification(id,action,r.user.id,b.assignedTo); }
  @Get('dashboard-preference') getPreference(@Request() r:any) { return this.service.preference(r.user.id); }
  @Patch('dashboard-preference') preference(@Body() b:any,@Request() r:any) { return this.service.preference(r.user.id,b.widgets); }
  @Get('accounting-export') export(@Query('start') s:string,@Query('end') e:string) { return this.service.accountingExport(s,e); }
  @Get('fiscal-parameters') parameters() { return this.service.list('fiscal_tax_parameters','category,code'); }
  @Post('fiscal-parameters') parameter(@Body() b:any,@Request() r:any) { return this.service.create('fiscal_tax_parameters',b,r.user.id,'fiscal.parameter_created'); }
  @Get('fiscal-profiles') profiles() { return this.service.list('fiscal_service_profiles','name'); }
  @Post('fiscal-profiles') profile(@Body() b:any,@Request() r:any) { return this.service.create('fiscal_service_profiles',{...b,settings:JSON.stringify(b.settings || {})},r.user.id,'fiscal.profile_created'); }
}
