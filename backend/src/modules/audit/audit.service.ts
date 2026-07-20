import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogsRepository: Repository<AuditLog>,
  ) {}

  async create(createAuditLogDto: any): Promise<AuditLog> {
    const log = this.auditLogsRepository.create(createAuditLogDto);
    const saved = await this.auditLogsRepository.save(log);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async safeCreate(createAuditLogDto: any): Promise<void> {
    try {
      await this.create(createAuditLogDto);
    } catch {
      // Auditoria nao deve bloquear a operacao principal.
    }
  }

  async findAll(): Promise<AuditLog[]> {
    return this.auditLogsRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
}
