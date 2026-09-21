import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

// Log de erro de QUALQUER requisição (não só as mutantes rastreadas por operation_runs, que
// ignora GET e a rota de auth de propósito) - capturado pelo filtro global de exceções
// (AllExceptionsFilter), sem depender de nenhum módulo lembrar de logar o próprio erro.
@Entity('error_logs')
export class ErrorLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'status_code', type: 'int' })
  statusCode: number;

  @Column({ length: 10 })
  method: string;

  @Column({ length: 500 })
  path: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text', nullable: true })
  stack: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'ip_address', length: 64, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
