import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { BankStatement } from './entities/bank-statement.entity';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @InjectRepository(BankStatement)
    private statementsRepo: Repository<BankStatement>,
    private dataSource: DataSource,
  ) {}

  // Import OFX file
  async importOFX(content: string, bankAccount: string): Promise<{ imported: number; duplicates: number }> {
    const transactions = this.parseOFX(content);
    const batch = 'OFX-' + Date.now();
    let imported = 0;
    let duplicates = 0;

    for (const tx of transactions) {
      // Check duplicate by transactionId
      if (tx.transactionId) {
        const existing = await this.statementsRepo.findOne({ where: { transactionId: tx.transactionId, bankAccount } });
        if (existing) { duplicates++; continue; }
      }

      const stmt = this.statementsRepo.create({
        transactionId: tx.transactionId,
        date: tx.date,
        amount: Math.abs(tx.amount),
        type: tx.amount >= 0 ? 'credito' : 'debito',
        description: tx.description,
        memo: tx.memo,
        documentNumber: tx.documentNumber,
        bankAccount,
        status: 'pendente',
        importBatch: batch,
        category: this.categorizeTransaction(tx.description || '', tx.memo || ''),
      });

      await this.statementsRepo.save(stmt);
      imported++;
    }

    return { imported, duplicates };
  }

  // Auto-reconcile: match statements with financial movements
  async autoReconcile(startDate: string, endDate: string, toleranceDays = 3, minScore = 80): Promise<{
    total: number; matched: number; pending: number; details: any[]
  }> {
    const statements = await this.statementsRepo.find({
      where: { status: 'pendente', date: Between(startDate, endDate) },
      order: { date: 'ASC' },
    });

    // Get financial movements in the period (with tolerance)
    const toleranceStart = new Date(startDate);
    toleranceStart.setDate(toleranceStart.getDate() - toleranceDays);
    const toleranceEnd = new Date(endDate);
    toleranceEnd.setDate(toleranceEnd.getDate() + toleranceDays);

    const movements = await this.dataSource.query(`
      SELECT id, type, category, description, value, date, payment_method, reference_id, is_forecast, sale_id
      FROM financial_movements
      WHERE date BETWEEN $1 AND $2
        AND is_forecast = false
        AND id NOT IN (SELECT matched_movement_id FROM bank_statements WHERE matched_movement_id IS NOT NULL)
      ORDER BY date ASC
    `, [toleranceStart.toISOString().split('T')[0], toleranceEnd.toISOString().split('T')[0]]);

    let matched = 0;
    const details: any[] = [];

    for (const stmt of statements) {
      let bestMatch: any = null;
      let bestScore = 0;

      for (const mov of movements) {
        const score = this.calculateScore(stmt, mov, toleranceDays);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = mov;
        }
      }

      if (bestScore >= minScore && bestMatch) {
        // Auto-reconcile
        stmt.status = 'conciliado_auto';
        stmt.matchedMovementId = bestMatch.id;
        stmt.matchScore = bestScore;
        stmt.reconciledAt = new Date();
        await this.statementsRepo.save(stmt);

        // Remove from available movements
        const idx = movements.findIndex(m => m.id === bestMatch.id);
        if (idx >= 0) movements.splice(idx, 1);

        matched++;
        details.push({
          statementId: stmt.id,
          movementId: bestMatch.id,
          score: bestScore,
          amount: stmt.amount,
          description: stmt.description,
          type: stmt.type,
        });
      }
    }

    return { total: statements.length, matched, pending: statements.length - matched, details };
  }

  // Manual reconcile
  async manualReconcile(statementId: string, movementId: string, userId: string): Promise<BankStatement> {
    const stmt = await this.statementsRepo.findOne({ where: { id: statementId } });
    if (!stmt) throw new BadRequestException('Lançamento do extrato não encontrado');

    stmt.status = 'conciliado_manual';
    stmt.matchedMovementId = movementId;
    stmt.matchScore = 100;
    stmt.reconciledBy = userId;
    stmt.reconciledAt = new Date();
    return this.statementsRepo.save(stmt);
  }

  // Undo reconciliation
  async undoReconcile(statementId: string, userId: string): Promise<BankStatement> {
    const stmt = await this.statementsRepo.findOne({ where: { id: statementId } });
    if (!stmt) throw new BadRequestException('Lançamento não encontrado');

    stmt.status = 'pendente';
    stmt.matchedMovementId = null;
    stmt.matchScore = null;
    stmt.reconciledBy = null;
    stmt.reconciledAt = null;
    return this.statementsRepo.save(stmt);
  }

  // Mark as ignored
  async ignoreStatement(statementId: string): Promise<BankStatement> {
    const stmt = await this.statementsRepo.findOne({ where: { id: statementId } });
    if (!stmt) throw new BadRequestException('Lançamento não encontrado');
    stmt.status = 'ignorado';
    return this.statementsRepo.save(stmt);
  }

  // Create financial movement from unmatched statement
  async createMovementFromStatement(statementId: string, userId: string): Promise<any> {
    const stmt = await this.statementsRepo.findOne({ where: { id: statementId } });
    if (!stmt) throw new BadRequestException('Lançamento não encontrado');

    const movType = stmt.type === 'credito' ? 'receita' : 'despesa';
    const category = stmt.category || 'outros';

    const result = await this.dataSource.query(`
      INSERT INTO financial_movements (type, category, description, value, date, payment_method, is_forecast, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, false, $7)
      RETURNING id
    `, [movType, category, stmt.description || 'Importado do extrato', stmt.amount, stmt.date, 'transferencia', userId]);

    if (result[0]?.id) {
      stmt.status = 'conciliado_manual';
      stmt.matchedMovementId = result[0].id;
      stmt.matchScore = 100;
      stmt.reconciledBy = userId;
      stmt.reconciledAt = new Date();
      await this.statementsRepo.save(stmt);
    }

    return { movementId: result[0]?.id, statement: stmt };
  }

  // Get summary/dashboard data
  async getSummary(startDate: string, endDate: string): Promise<any> {
    const statements = await this.statementsRepo.find({
      where: { date: Between(startDate, endDate) },
    });

    const creditos = statements.filter(s => s.type === 'credito');
    const debitos = statements.filter(s => s.type === 'debito');
    const conciliados = statements.filter(s => s.status.startsWith('conciliado'));
    const pendentes = statements.filter(s => s.status === 'pendente');
    const divergentes = statements.filter(s => s.status === 'divergente');

    const totalCreditos = creditos.reduce((s, c) => s + Number(c.amount), 0);
    const totalDebitos = debitos.reduce((s, d) => s + Number(d.amount), 0);
    const totalConciliadoCredito = conciliados.filter(c => c.type === 'credito').reduce((s, c) => s + Number(c.amount), 0);
    const totalConciliadoDebito = conciliados.filter(c => c.type === 'debito').reduce((s, c) => s + Number(c.amount), 0);
    const totalPendenteCredito = pendentes.filter(c => c.type === 'credito').reduce((s, c) => s + Number(c.amount), 0);
    const totalPendenteDebito = pendentes.filter(c => c.type === 'debito').reduce((s, c) => s + Number(c.amount), 0);

    // Get system financial movements total
    const systemData = await this.dataSource.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'receita' THEN value ELSE 0 END), 0) as total_receitas,
        COALESCE(SUM(CASE WHEN type = 'despesa' THEN value ELSE 0 END), 0) as total_despesas
      FROM financial_movements
      WHERE date BETWEEN $1 AND $2 AND is_forecast = false
    `, [startDate, endDate]);

    const saldoExtrato = totalCreditos - totalDebitos;
    const saldoSistema = Number(systemData[0]?.total_receitas || 0) - Number(systemData[0]?.total_despesas || 0);
    const diferenca = saldoExtrato - saldoSistema;
    const percentual = statements.length > 0 ? Math.round((conciliados.length / statements.length) * 100) : 0;

    return {
      totalLancamentos: statements.length,
      totalCreditos,
      totalDebitos,
      saldoExtrato,
      saldoSistema,
      diferenca,
      percentualConciliado: percentual,
      qtdConciliados: conciliados.length,
      qtdPendentes: pendentes.length,
      qtdDivergentes: divergentes.length,
      totalConciliadoCredito,
      totalConciliadoDebito,
      totalPendenteCredito,
      totalPendenteDebito,
    };
  }

  // Get all statements with filters
  async findAll(filters?: { startDate?: string; endDate?: string; status?: string; type?: string; search?: string }): Promise<BankStatement[]> {
    const qb = this.statementsRepo.createQueryBuilder('s').orderBy('s.date', 'DESC');

    if (filters?.startDate) qb.andWhere('s.date >= :startDate', { startDate: filters.startDate });
    if (filters?.endDate) qb.andWhere('s.date <= :endDate', { endDate: filters.endDate });
    if (filters?.status) qb.andWhere('s.status = :status', { status: filters.status });
    if (filters?.type) qb.andWhere('s.type = :type', { type: filters.type });
    if (filters?.search) qb.andWhere('(s.description ILIKE :search OR s.memo ILIKE :search OR s.document_number ILIKE :search)', { search: `%${filters.search}%` });

    return qb.getMany();
  }

  // Get unmatched financial movements for a period
  async getUnmatchedMovements(startDate: string, endDate: string): Promise<any[]> {
    return this.dataSource.query(`
      SELECT fm.id, fm.type, fm.category, fm.description, fm.value, fm.date, fm.payment_method, fm.sale_id
      FROM financial_movements fm
      WHERE fm.date BETWEEN $1 AND $2
        AND fm.is_forecast = false
        AND fm.id NOT IN (SELECT matched_movement_id FROM bank_statements WHERE matched_movement_id IS NOT NULL)
      ORDER BY fm.date DESC
    `, [startDate, endDate]);
  }

  // ==================== Private Helpers ====================

  private calculateScore(stmt: BankStatement, mov: any, toleranceDays: number): number {
    let score = 0;
    const stmtAmount = Number(stmt.amount);
    const movAmount = Number(mov.value);

    // Value match (+60)
    if (Math.abs(stmtAmount - movAmount) < 0.01) score += 60;
    else if (Math.abs(stmtAmount - movAmount) < 1.00) score += 30;

    // Type match (+20)
    const stmtIsCredit = stmt.type === 'credito';
    const movIsCredit = mov.type === 'receita';
    if (stmtIsCredit === movIsCredit) score += 20;

    // Date match (+15 exact, +10 within tolerance)
    const stmtDate = new Date(stmt.date + 'T12:00:00');
    const movDate = new Date(mov.date + 'T12:00:00');
    const diffDays = Math.abs(Math.ceil((stmtDate.getTime() - movDate.getTime()) / (1000 * 60 * 60 * 24)));
    if (diffDays === 0) score += 15;
    else if (diffDays <= toleranceDays) score += 10;

    // Description similarity (+20)
    if (stmt.description && mov.description) {
      const similarity = this.stringSimilarity(stmt.description.toLowerCase(), mov.description.toLowerCase());
      score += Math.round(similarity * 20);
    }

    // Document/reference match (+30)
    if (stmt.documentNumber && mov.reference_id) {
      if (stmt.documentNumber === mov.reference_id) score += 30;
      else if (stmt.documentNumber.includes(mov.reference_id) || mov.reference_id.includes(stmt.documentNumber)) score += 15;
    }

    return score;
  }

  private stringSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;
    // Simple word overlap similarity
    const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
    const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;
    let matches = 0;
    wordsA.forEach(w => { if (wordsB.has(w)) matches++; });
    return matches / Math.max(wordsA.size, wordsB.size);
  }

  private categorizeTransaction(description: string, memo: string): string {
    const text = (description + ' ' + memo).toLowerCase();
    if (text.includes('tarifa') || text.includes('taxa') || text.includes('anuidade')) return 'tarifa';
    if (text.includes('juros') || text.includes('rendiment') || text.includes('aplicacao')) return 'rendimento';
    if (text.includes('iof')) return 'iof';
    if (text.includes('estorno') || text.includes('devolu')) return 'estorno';
    if (text.includes('ted')) return 'ted';
    if (text.includes('doc ')) return 'doc';
    if (text.includes('pix')) return 'pix';
    if (text.includes('boleto') || text.includes('cobranca')) return 'boleto';
    if (text.includes('transferencia') || text.includes('transf')) return 'transferencia';
    if (text.includes('deposito')) return 'deposito';
    if (text.includes('saque')) return 'saque';
    return 'outros';
  }

  private parseOFX(content: string): Array<{ transactionId: string; date: string; amount: number; description: string; memo: string; documentNumber: string }> {
    const transactions: any[] = [];
    // Simple OFX parser
    const txRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let match;
    while ((match = txRegex.exec(content)) !== null) {
      const block = match[1];
      const getValue = (tag: string) => {
        const m = block.match(new RegExp(`<${tag}>([^<\\n]+)`, 'i'));
        return m ? m[1].trim() : '';
      };

      const dtPosted = getValue('DTPOSTED');
      let date = '';
      if (dtPosted.length >= 8) {
        date = dtPosted.substring(0, 4) + '-' + dtPosted.substring(4, 6) + '-' + dtPosted.substring(6, 8);
      }

      transactions.push({
        transactionId: getValue('FITID'),
        date,
        amount: parseFloat(getValue('TRNAMT')) || 0,
        description: getValue('NAME') || getValue('MEMO'),
        memo: getValue('MEMO'),
        documentNumber: getValue('CHECKNUM') || getValue('REFNUM') || '',
      });
    }
    return transactions;
  }
}
