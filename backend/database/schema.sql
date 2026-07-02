-- Sistema de Gestão para Empresa de TI e Assistência Técnica
-- PostgreSQL Database Schema

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'financeiro', 'tecnico')),
    active BOOLEAN DEFAULT TRUE,
    observations TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    cpf_cnpj VARCHAR(20),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    observations TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Produtos
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    quantity INTEGER DEFAULT 0,
    purchase_price DECIMAL(10, 2) NOT NULL,
    sale_price DECIMAL(10, 2) NOT NULL,
    tax_percentage DECIMAL(5, 2) DEFAULT 0,
    supplier VARCHAR(255),
    min_stock INTEGER DEFAULT 5,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Serviços
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sale_price DECIMAL(10, 2) NOT NULL,
    operational_cost DECIMAL(10, 2) DEFAULT 0,
    tax_percentage DECIMAL(5, 2) DEFAULT 0,
    estimated_time INTEGER,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN services.estimated_time IS 'Tempo estimado em minutos';

-- Tabela de Vendas
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id UUID NOT NULL REFERENCES users(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aguardando_financeiro', 'pago', 'comissao_paga', 'finalizado', 'cancelado')),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'transferencia', 'boleto')),
    subtotal DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    net_profit DECIMAL(10, 2) DEFAULT 0,
    commission_percentage DECIMAL(5, 2) DEFAULT 5,
    commission_amount DECIMAL(10, 2) DEFAULT 0,
    observations TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Itens da Venda
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    service_id UUID REFERENCES services(id),
    name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    tax_percentage DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    cost_price DECIMAL(10, 2) DEFAULT 0,
    net_profit DECIMAL(10, 2) DEFAULT 0,
    CHECK (product_id IS NOT NULL OR service_id IS NOT NULL)
);

-- Tabela de Movimentações de Estoque
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('entrada', 'saida', 'ajuste', 'venda')),
    quantity INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    reason TEXT,
    user_id UUID REFERENCES users(id),
    sale_id UUID REFERENCES sales(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Comissões
CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('venda', 'avulsa')),
    sale_id UUID REFERENCES sales(id),
    description VARCHAR(255),
    base_value DECIMAL(10, 2) NOT NULL,
    percentage DECIMAL(5, 2) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'paga', 'cancelada')),
    observations TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    paid_by UUID REFERENCES users(id),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Contratos
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_value DECIMAL(10, 2) NOT NULL,
    monthly_value DECIMAL(10, 2),
    start_date DATE NOT NULL,
    end_date DATE,
    sla_internal INTEGER DEFAULT 4,
    sla_external INTEGER DEFAULT 24,
    file_name VARCHAR(255),
    file_path TEXT,
    file_size INTEGER,
    status VARCHAR(20) DEFAULT 'ativo',
    observations TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Rotas
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id UUID NOT NULL REFERENCES users(id),
    description VARCHAR(255) NOT NULL,
    origin VARCHAR(255),
    destination VARCHAR(255),
    km DECIMAL(10, 2) NOT NULL,
    rate_per_km DECIMAL(10, 2) DEFAULT 1.30,
    total_value DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente',
    observations TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    paid_by UUID REFERENCES users(id),
    paid_at TIMESTAMP,
    route_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Trechos de Rota
CREATE TABLE IF NOT EXISTS route_legs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    origin VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    km DECIMAL(10, 2) NOT NULL,
    sort_order INTEGER DEFAULT 0
);

-- Tabela de Tarefas Financeiras
CREATE TABLE IF NOT EXISTS financial_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id),
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente',
    due_date DATE,
    completed_by UUID REFERENCES users(id),
    completed_at TIMESTAMP,
    observations TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Contas a Receber
CREATE TABLE IF NOT EXISTS accounts_receivable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    description VARCHAR(255),
    total_value DECIMAL(10, 2) NOT NULL,
    paid_value DECIMAL(10, 2) DEFAULT 0,
    pending_value DECIMAL(10, 2) NOT NULL,
    installments INTEGER DEFAULT 1,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente',
    due_date DATE,
    paid_at TIMESTAMP,
    canceled_at TIMESTAMP,
    cancel_reason TEXT,
    observations TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Parcelas
CREATE TABLE IF NOT EXISTS installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts_receivable(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id),
    number INTEGER NOT NULL,
    value DECIMAL(10, 2) NOT NULL,
    paid_value DECIMAL(10, 2) DEFAULT 0,
    due_date DATE NOT NULL,
    paid_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pendente',
    payment_method VARCHAR(50),
    observations TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Movimentações Financeiras
CREATE TABLE IF NOT EXISTS financial_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    value DECIMAL(10, 2) NOT NULL,
    date DATE NOT NULL,
    sale_id UUID REFERENCES sales(id),
    account_id UUID REFERENCES accounts_receivable(id),
    installment_id UUID REFERENCES installments(id),
    payment_method VARCHAR(50),
    bank_account VARCHAR(100),
    reference_id UUID,
    reference_type VARCHAR(50),
    is_forecast BOOLEAN DEFAULT FALSE,
    observations TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Taxas de Cartão
CREATE TABLE IF NOT EXISTS card_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator VARCHAR(100) NOT NULL,
    payment_type VARCHAR(20) NOT NULL,
    installments_from INTEGER DEFAULT 1,
    installments_to INTEGER DEFAULT 1,
    fee_percentage DECIMAL(5, 2) NOT NULL,
    days_to_receive INTEGER DEFAULT 30,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Créditos de Cliente
CREATE TABLE IF NOT EXISTS customer_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id),
    sale_id UUID REFERENCES sales(id),
    value DECIMAL(10, 2) NOT NULL,
    used_value DECIMAL(10, 2) DEFAULT 0,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'ativo',
    expires_at TIMESTAMP,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Certificados Digitais
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    cnpj VARCHAR(20) NOT NULL,
    serial_number VARCHAR(255),
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    pfx_data TEXT NOT NULL,
    pfx_password TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Configuração Fiscal
CREATE TABLE IF NOT EXISTS fiscal_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cnpj VARCHAR(20) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    state_registration VARCHAR(20),
    city_registration VARCHAR(20),
    tax_regime INTEGER DEFAULT 1,
    nfe_series INTEGER DEFAULT 1,
    nfe_next_number INTEGER DEFAULT 1,
    nfse_series INTEGER DEFAULT 1,
    nfse_next_number INTEGER DEFAULT 1,
    environment INTEGER DEFAULT 2,
    uf_code VARCHAR(2) DEFAULT '31',
    city_code VARCHAR(7) DEFAULT '3118601',
    nfse_api_url VARCHAR(500),
    nfse_test_url VARCHAR(500),
    emit_address VARCHAR(255),
    emit_number VARCHAR(60),
    emit_neighborhood VARCHAR(100),
    emit_cep VARCHAR(10),
    emit_phone VARCHAR(20),
    nfce_series INTEGER DEFAULT 1,
    nfce_next_number INTEGER DEFAULT 1,
    nfce_csc_id VARCHAR(10),
    nfce_csc_token VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Notas Fiscais
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES sales(id),
    certificate_id UUID REFERENCES certificates(id),
    type VARCHAR(10) NOT NULL,
    number INTEGER,
    series INTEGER DEFAULT 1,
    access_key VARCHAR(100),
    protocol_number VARCHAR(50),
    verification_code VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pendente',
    xml_sent TEXT,
    xml_authorized TEXT,
    xml_cancel TEXT,
    rejection_reason TEXT,
    cancel_reason TEXT,
    cancel_protocol VARCHAR(50),
    canceled_at TIMESTAMP,
    issuer_cnpj VARCHAR(20),
    recipient_cnpj VARCHAR(20),
    recipient_name VARCHAR(255),
    total_value DECIMAL(10, 2),
    environment INTEGER DEFAULT 2,
    city_code VARCHAR(10),
    observations TEXT,
    issued_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Configuração GLPI
CREATE TABLE IF NOT EXISTS glpi_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_url VARCHAR(500) NOT NULL,
    app_token VARCHAR(255) NOT NULL,
    user_token VARCHAR(255),
    session_token VARCHAR(255),
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Tickets GLPI
CREATE TABLE IF NOT EXISTS glpi_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    glpi_ticket_id INTEGER NOT NULL,
    customer_id UUID REFERENCES customers(id),
    contract_id UUID REFERENCES contracts(id),
    glpi_entity_id INTEGER,
    title VARCHAR(500) NOT NULL,
    status INTEGER,
    type INTEGER,
    priority INTEGER,
    date_opened TIMESTAMP,
    date_closed TIMESTAMP,
    sla_type VARCHAR(20),
    sla_limit_hours INTEGER,
    time_spent_hours DECIMAL(10, 2) DEFAULT 0,
    sla_exceeded BOOLEAN DEFAULT FALSE,
    exceeded_hours DECIMAL(10, 2) DEFAULT 0,
    exceeded_charge DECIMAL(10, 2) DEFAULT 0,
    charge_rate DECIMAL(10, 2) DEFAULT 80,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Logs de Auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Reset de Senha
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_customers_cpf_cnpj ON customers(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_sales_technician ON sales(technician_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_commissions_technician ON commissions(technician_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_contracts_customer ON contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_routes_technician ON routes(technician_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_date ON routes(route_date);
CREATE INDEX IF NOT EXISTS idx_financial_tasks_sale ON financial_tasks(sale_id);
CREATE INDEX IF NOT EXISTS idx_financial_tasks_status ON financial_tasks(status);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_sale ON accounts_receivable(sale_id);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_customer ON accounts_receivable(customer_id);
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_status ON accounts_receivable(status);
CREATE INDEX IF NOT EXISTS idx_installments_account ON installments(account_id);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date);
CREATE INDEX IF NOT EXISTS idx_financial_movements_date ON financial_movements(date);
CREATE INDEX IF NOT EXISTS idx_financial_movements_category ON financial_movements(category);
CREATE INDEX IF NOT EXISTS idx_invoices_sale ON invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_glpi_tickets_customer ON glpi_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_glpi_tickets_contract ON glpi_tickets(contract_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
