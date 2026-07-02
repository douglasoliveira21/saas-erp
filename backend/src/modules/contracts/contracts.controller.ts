import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Response } from 'express';
import { existsSync, createReadStream } from 'fs';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

const uploadDir = join(__dirname, '..', '..', '..', 'uploads', 'contracts');

@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: uploadDir,
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  }))
  async create(@Body() body: any, @UploadedFile() file: any, @Request() req: any) {
    const dto: any = {
      customerId: body.customerId,
      title: body.title,
      description: body.description,
      totalValue: parseFloat(body.totalValue),
      monthlyValue: body.monthlyValue ? parseFloat(body.monthlyValue) : null,
      startDate: body.startDate,
      endDate: body.endDate || null,
      slaInternal: parseInt(body.slaInternal) || 4,
      slaExternal: parseInt(body.slaExternal) || 24,
      observations: body.observations,
      createdBy: req.user.id,
    };

    if (file) {
      dto.fileName = file.originalname;
      dto.filePath = file.path;
      dto.fileSize = file.size;
    }

    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const contract = await this.service.findOne(id);
    if (!contract.filePath || !existsSync(contract.filePath)) {
      return res.status(404).json({ message: 'Arquivo nao encontrado' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${contract.fileName}"`);
    const stream = createReadStream(contract.filePath);
    stream.pipe(res);
  }

  @Get('customer/:customerId')
  findByCustomer(@Param('customerId') customerId: string) {
    return this.service.findByCustomer(customerId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: uploadDir,
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async update(@Param('id') id: string, @Body() body: any, @UploadedFile() file: any) {
    const dto: any = { ...body };
    if (dto.totalValue) dto.totalValue = parseFloat(dto.totalValue);
    if (dto.monthlyValue) dto.monthlyValue = parseFloat(dto.monthlyValue);
    if (dto.slaInternal) dto.slaInternal = parseInt(dto.slaInternal);
    if (dto.slaExternal) dto.slaExternal = parseInt(dto.slaExternal);
    if (file) {
      dto.fileName = file.originalname;
      dto.filePath = file.path;
      dto.fileSize = file.size;
    }
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
