import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { CrmService } from './crm.service'; import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator'; import { UserRole } from '../../common/enums/user-role.enum';
import { PlanGuard } from '../platform/guards/plan.guard'; import { RequireModule } from '../platform/decorators/require-module.decorator';
const internalRoles = [UserRole.ADMIN, UserRole.FINANCEIRO, UserRole.TECNICO];
@Controller('crm') @UseGuards(JwtAuthGuard,RolesGuard,PlanGuard) @RequireModule('crm')
export class CrmController {
 constructor(private service:CrmService){}
 @Get('opportunities') @Roles(...internalRoles) list(@Query('stage')s?:string,@Query('customerId')c?:string){return this.service.findAll(s,c)}
 @Get('summary') @Roles(...internalRoles) summary(){return this.service.summary()}
 @Get('opportunities/:id') @Roles(...internalRoles) one(@Param('id')id:string){return this.service.findOne(id)}
 @Post('opportunities') @Roles(...internalRoles) create(@Body()b:any,@Request()r){return this.service.create(b,r.user.id)}
 @Patch('opportunities/:id') @Roles(...internalRoles) update(@Param('id')id:string,@Body()b:any){return this.service.update(id,b)}
 @Delete('opportunities/:id') @Roles(UserRole.ADMIN) remove(@Param('id')id:string){return this.service.remove(id)}
}
