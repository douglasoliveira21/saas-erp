import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import { QuotesService } from './quotes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuotesController {
  constructor(private readonly service: QuotesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO, UserRole.TECNICO)
  create(@Body() dto: any, @Request() req: any) { return this.service.create(dto, req.user.id); }

  @Get()
  findAll(@Query() query: any) { return this.service.findAll(query); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  approve(@Param('id') id: string) { return this.service.approve(id); }

  @Post(':id/convert')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  convert(@Param('id') id: string, @Body() body: any, @Request() req: any) { return this.service.convertToSale(id, req.user.id, body); }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  reject(@Param('id') id: string, @Body() body: any) { return this.service.reject(id, body?.reason); }

  @Post(':id/duplicate')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO, UserRole.TECNICO)
  duplicate(@Param('id') id: string, @Request() req: any) { return this.service.duplicate(id, req.user.id); }

  @Get(':id/pdf')
  async getPdfAuth(@Param('id') id: string, @Res() res: Response) {
    const html = await this.service.generatePdfHtml(id);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
