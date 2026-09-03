import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { ServiceOrdersService } from './service-orders.service';
import { ServiceOrderPdfService } from './service-order-pdf.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

const internalRoles = [UserRole.ADMIN, UserRole.FINANCEIRO, UserRole.TECNICO];
const uploadDir = join(process.cwd(), 'uploads', 'service-orders');
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

@Controller('service-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceOrdersController {
  constructor(
    private readonly service: ServiceOrdersService,
    private readonly pdfService: ServiceOrderPdfService,
  ) {}

  @Get('statuses')
  @Roles(...internalRoles)
  listStatuses(@Query('all') all?: string) {
    return this.service.findAllStatuses(all === 'true');
  }

  @Post('statuses')
  @Roles(UserRole.ADMIN)
  createStatus(@Body() body: any) {
    return this.service.createStatus(body);
  }

  @Patch('statuses/:id')
  @Roles(UserRole.ADMIN)
  updateStatus(@Param('id') id: string, @Body() body: any) {
    return this.service.updateStatus(id, body);
  }

  @Delete('statuses/:id')
  @Roles(UserRole.ADMIN)
  removeStatus(@Param('id') id: string) {
    return this.service.removeStatus(id);
  }

  @Get()
  @Roles(...internalRoles)
  findAll(
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('technicianId') technicianId?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({ status, customerId, technicianId, search });
  }

  @Get(':id')
  @Roles(...internalRoles)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/events')
  @Roles(...internalRoles)
  getEvents(@Param('id') id: string) {
    return this.service.getEvents(id);
  }

  @Post()
  @Roles(...internalRoles)
  create(@Body() body: any, @Request() req: any) {
    return this.service.create(body, req.user.id);
  }

  @Patch(':id')
  @Roles(...internalRoles)
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.service.update(id, body, req.user.id);
  }

  @Patch(':id/conclude')
  @Roles(...internalRoles)
  conclude(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.service.conclude(id, body, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/attachments')
  @Roles(...internalRoles)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  addAttachments(
    @Param('id') id: string,
    @UploadedFiles() files: any[],
    @Body('type') type: string,
    @Request() req: any,
  ) {
    if (!files?.length) throw new BadRequestException('Envie ao menos um arquivo');
    return this.service.addAttachments(id, files, type || 'geral', req.user.id);
  }

  @Get(':id/attachments/:attachmentId/inline')
  @Roles(...internalRoles)
  async viewAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string, @Res() res: Response) {
    const attachment = await this.service.getAttachment(id, attachmentId);
    if (!existsSync(attachment.storagePath)) {
      return res.status(404).json({ message: 'Arquivo não encontrado' });
    }
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${attachment.filename}"`);
    createReadStream(attachment.storagePath).pipe(res);
  }

  @Delete(':id/attachments/:attachmentId')
  @Roles(...internalRoles)
  removeAttachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string, @Request() req: any) {
    return this.service.removeAttachment(id, attachmentId, req.user.id);
  }

  @Get(':id/pdf')
  @Roles(...internalRoles)
  async downloadPdf(@Param('id') id: string, @Query('download') download: string, @Res() res: Response) {
    const buffer = await this.pdfService.generate(id);
    const disposition = download === '1' || download === 'true' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="ordem-servico-${id}.pdf"`);
    res.send(buffer);
  }
}
