import { BadRequestException, Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

const salesUploadDir = join(process.cwd(), 'uploads', 'sales');
if (!existsSync(salesUploadDir)) mkdirSync(salesUploadDir, { recursive: true });

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(@Body() createSaleDto: any, @Request() req: any) {
    return this.salesService.create({ ...createSaleDto, technicianId: createSaleDto.technicianId || req.user.id }, req.user.id);
  }

  @Get()
  findAll() {
    return this.salesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  approve(@Param('id') id: string, @Request() req: any) {
    return this.salesService.approve(id, req.user.id);
  }

  @Patch(':id/boleto-emitido')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  markBoletoEmitido(@Param('id') id: string, @Request() req: any) {
    return this.salesService.markBoletoEmitido(id, req.user.id);
  }

  @Patch(':id/mark-paid')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  markPaid(@Param('id') id: string, @Request() req: any) {
    return this.salesService.markPaid(id, req.user.id);
  }

  @Patch(':id/finalize')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  finalize(@Param('id') id: string) {
    return this.salesService.finalize(id);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.salesService.cancel(id, req.user.id);
  }

  @Post(':id/send-documents')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  sendDocuments(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.salesService.resendDocuments(id, body?.body, req.user.id);
  }

  @Patch(':id/approve-commercial')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  approveCommercial(@Param('id') id: string, @Request() req: any) {
    return this.salesService.approveCommercial(id, req.user.id);
  }

  @Patch(':id/approve-financial')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  approveFinancial(@Param('id') id: string, @Request() req: any) {
    return this.salesService.approveFinancial(id, req.user.id);
  }

  @Patch(':id/approve-discount')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  approveDiscount(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.salesService.approveDiscount(id, Number(body.discountAmount || 0), req.user.id, body.reason);
  }

  @Post(':id/attachments')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: salesUploadDir,
      filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + extname(file.originalname));
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  addAttachment(@Param('id') id: string, @Body() body: any, @UploadedFile() file: any, @Request() req: any) {
    if (!file && !body.storagePath) throw new BadRequestException('Envie um arquivo ou informe o caminho do anexo');
    const payload = file ? {
      filename: file.originalname,
      type: body.type || 'outro',
      mimeType: file.mimetype,
      storagePath: file.path,
    } : body;
    return this.salesService.addAttachment(id, payload, req.user.id);
  }

  @Get(':id/attachments/:attachmentId/download')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  async downloadAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string, @Res() res: Response) {
    const attachment = await this.salesService.getAttachment(id, attachmentId);
    if (!existsSync(attachment.storagePath)) {
      return res.status(404).json({ message: 'Arquivo não encontrado' });
    }
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    createReadStream(attachment.storagePath).pipe(res);
  }

  @Get(':id/events')
  getEvents(@Param('id') id: string) {
    return this.salesService.getEvents(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSaleDto: any, @Request() req: any) {
    return this.salesService.update(id, updateSaleDto, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.salesService.remove(id, req.user.id);
  }
}
