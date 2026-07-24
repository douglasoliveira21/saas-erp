import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import { QuotesService } from './quotes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtService } from '@nestjs/jwt';

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

// Controller público para PDF (sem JWT guard - usa token via query)
@Controller('quotes-public')
export class QuotesPublicController {
  constructor(private readonly service: QuotesService, private readonly jwtService: JwtService) {}

  @Get(':id/pdf')
  async getPdf(@Param('id') id: string, @Query('token') token: string, @Res() res: Response) {
    if (!token) {
      res.status(401).json({ message: 'Token obrigatório' });
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync(token);
      if (!payload?.sub) throw new Error('Invalid');
    } catch {
      res.status(401).json({ message: 'Token inválido ou expirado' });
      return;
    }
    const html = await this.service.generatePdfHtml(id);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
