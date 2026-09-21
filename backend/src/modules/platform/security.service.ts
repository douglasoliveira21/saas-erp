import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BlockedIp } from '../auth/entities/blocked-ip.entity';
import { ErrorLog } from '../../common/errors/error-log.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

@Injectable()
export class SecurityService {
  constructor(
    @InjectRepository(BlockedIp) private blockedIpRepository: Repository<BlockedIp>,
    @InjectRepository(ErrorLog) private errorLogRepository: Repository<ErrorLog>,
    @InjectRepository(AuditLog) private auditLogRepository: Repository<AuditLog>,
    private dataSource: DataSource,
  ) {}

  // ==================== IPs bloqueados ====================
  async findBlockedIps() {
    return this.blockedIpRepository.find({ order: { blocked: 'DESC', lastAttemptAt: 'DESC' }, take: 200 });
  }

  async unblockIp(id: string, superAdminId: string) {
    const row = await this.blockedIpRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Registro não encontrado');
    row.blocked = false;
    row.failedAttempts = 0;
    row.unblockedAt = new Date();
    row.unblockedBy = superAdminId;
    return this.blockedIpRepository.save(row);
  }

  // ==================== Contas bloqueadas (qualquer tenant) ====================
  async findLockedAccounts() {
    return this.dataSource.query(`
      SELECT u.id, u.name, u.email, u.role, u.failed_login_attempts AS "failedLoginAttempts",
             u.locked_until AS "lockedUntil", t.id AS "tenantId", t.name AS "tenantName"
      FROM users u
      LEFT JOIN tenants t ON t.id = u.tenant_id
      WHERE u.locked_until IS NOT NULL AND u.locked_until > now() AND u.archived_at IS NULL
      ORDER BY u.locked_until DESC
      LIMIT 200
    `);
  }

  async unlockAccount(userId: string) {
    const result = await this.dataSource.query(
      `UPDATE users SET locked_until = NULL, failed_login_attempts = 0, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [userId],
    );
    if (!result.length) throw new NotFoundException('Usuário não encontrado');
    return { success: true };
  }

  // ==================== Logs ====================
  async findErrorLogs(limit = 200) {
    return this.errorLogRepository.find({ order: { createdAt: 'DESC' }, take: Math.min(limit, 500) });
  }

  async findAuditLogs(limit = 200) {
    return this.auditLogRepository.find({ relations: ['user'], order: { createdAt: 'DESC' }, take: Math.min(limit, 500) });
  }
}
