import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RequireModule } from '../platform/decorators/require-module.decorator';
import { PlanGuard } from '../platform/guards/plan.guard';
import { XmlEntryService } from './xml-entry.service';

@Controller('fiscal/xml-entry')
@RequireModule('fiscal')
@Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
@UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)
export class XmlEntryController {
  constructor(private readonly service: XmlEntryService) {}
  @Post('preview') preview(@Body() body: any) { return this.service.preview(body?.xml); }
  @Post('import') import(@Body() body: any, @Req() request: any) { return this.service.import(body, request.user.id); }
}
