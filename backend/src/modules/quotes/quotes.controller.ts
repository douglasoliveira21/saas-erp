import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import { QuotesService } from './quotes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('quotes')
@UseGuards(JwtAuthGuard)
export class QuotesController {
  constructor(private readonly service: QuotesService) {}

  @Post()
  create(@Body() dto: any, @Request() req: any) { return this.service.create(dto, req.user.id); }

  @Get()
  findAll(@Query() query: any) { return this.service.findAll(query); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }

  @Patch(':id/approve')
  approve(@Param('id') id: string) { return this.service.approve(id); }

  @Post(':id/convert')
  convert(@Param('id') id: string, @Body() body: any, @Request() req: any) { return this.service.convertToSale(id, req.user.id, body); }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() body: any) { return this.service.reject(id, body?.reason); }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Request() req: any) { return this.service.duplicate(id, req.user.id); }

  @Get(':id/pdf')
  async getPdfAuth(@Param('id') id: string, @Res() res: Response) {
    const html = await this.service.generatePdfHtml(id);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}

// Controller público para PDF (sem JWT guard - usa token via query)
@Controller('quotes-public')
export class QuotesPublicController {
  constructor(private readonly service: QuotesService) {}

  @Get(':id/pdf')
  async getPdf(@Param('id') id: string, @Query('token') token: string, @Res() res: Response) {
    if (!token) {
      res.status(401).json({ message: 'Token obrigatório' });
      return;
    }
    // Validação básica do token (verificar se é um JWT válido)
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      if (!payload.sub || !payload.exp) throw new Error('Invalid');
      if (payload.exp * 1000 < Date.now()) throw new Error('Expired');
    } catch {
      res.status(401).json({ message: 'Token inválido ou expirado' });
      return;
    }
    const html = await this.service.generatePdfHtml(id);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
