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
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    const html = await this.service.generatePdfHtml(id);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
