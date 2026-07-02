-- Seed Data para Sistema de Gestão de TI
-- Senhas: Admin@123, Financeiro@123, Tecnico@123
-- Hash bcrypt com salt rounds = 10

-- Usuários
INSERT INTO users (id, name, email, password, role, active) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Administrador', 'admin@empresa.com', '$2b$10$YourHashHere', 'admin', true),
('550e8400-e29b-41d4-a716-446655440002', 'Maria Financeiro', 'financeiro@empresa.com', '$2b$10$YourHashHere', 'financeiro', true),
('550e8400-e29b-41d4-a716-446655440003', 'João Técnico', 'tecnico@empresa.com', '$2b$10$YourHashHere', 'tecnico', true),
('550e8400-e29b-41d4-a716-446655440004', 'Pedro Técnico', 'pedro@empresa.com', '$2b$10$YourHashHere', 'tecnico', true);

-- Clientes
INSERT INTO customers (name, cpf_cnpj, phone, email, address) VALUES
('Cliente Exemplo 1', '123.456.789-00', '(11) 98765-4321', 'cliente1@email.com', 'Rua Exemplo, 123 - São Paulo/SP'),
('Empresa XYZ Ltda', '12.345.678/0001-90', '(11) 3456-7890', 'contato@empresaxyz.com', 'Av. Paulista, 1000 - São Paulo/SP'),
('Cliente Exemplo 2', '987.654.321-00', '(11) 91234-5678', 'cliente2@email.com', 'Rua Teste, 456 - São Paulo/SP');

-- Produtos
INSERT INTO products (name, code, category, quantity, purchase_price, sale_price, tax_percentage, supplier, min_stock) VALUES
('Memória RAM DDR4 8GB', 'RAM-DDR4-8GB', 'Memória', 50, 150.00, 250.00, 18.00, 'Fornecedor A', 10),
('SSD 240GB SATA', 'SSD-240GB', 'Armazenamento', 30, 180.00, 300.00, 18.00, 'Fornecedor A', 5),
('HD 1TB SATA', 'HD-1TB', 'Armazenamento', 25, 200.00, 350.00, 18.00, 'Fornecedor B', 5),
('Cooler para Processador', 'COOLER-CPU', 'Refrigeração', 40, 50.00, 100.00, 18.00, 'Fornecedor C', 10),
('Fonte 500W', 'FONTE-500W', 'Fonte', 20, 150.00, 280.00, 18.00, 'Fornecedor A', 5),
('Placa Mãe H410M', 'MB-H410M', 'Placa Mãe', 15, 400.00, 650.00, 18.00, 'Fornecedor B', 3),
('Notebook Dell Inspiron', 'NB-DELL-I15', 'Notebook', 10, 2500.00, 3800.00, 18.00, 'Fornecedor D', 2),
('Mouse Gamer RGB', 'MOUSE-RGB', 'Periféricos', 60, 80.00, 150.00, 18.00, 'Fornecedor C', 15),
('Teclado Mecânico', 'TECLADO-MEC', 'Periféricos', 35, 200.00, 380.00, 18.00, 'Fornecedor C', 10),
('Monitor 24" Full HD', 'MONITOR-24', 'Monitor', 12, 600.00, 950.00, 18.00, 'Fornecedor D', 3);

-- Serviços
INSERT INTO services (name, description, sale_price, operational_cost, tax_percentage, estimated_time) VALUES
('Formatação Completa', 'Formatação do sistema operacional com instalação de drivers', 150.00, 20.00, 10.00, 120),
('Backup de Dados', 'Backup completo de arquivos e documentos', 100.00, 15.00, 10.00, 60),
('Limpeza Interna', 'Limpeza física interna do computador', 80.00, 10.00, 10.00, 45),
('Manutenção Preventiva', 'Manutenção preventiva completa do equipamento', 120.00, 15.00, 10.00, 90),
('Instalação de Software', 'Instalação e configuração de software', 60.00, 5.00, 10.00, 30),
('Suporte Remoto', 'Suporte técnico remoto', 80.00, 5.00, 10.00, 60),
('Montagem de PC', 'Montagem completa de computador', 200.00, 30.00, 10.00, 180),
('Recuperação de Dados', 'Recuperação de dados de HD/SSD', 300.00, 50.00, 10.00, 240),
('Configuração de Rede', 'Configuração de rede e internet', 150.00, 20.00, 10.00, 120),
('Instalação de Antivírus', 'Instalação e configuração de antivírus', 50.00, 5.00, 10.00, 30);

-- Nota: As senhas precisam ser geradas com bcrypt
-- Você pode usar o comando abaixo no Node.js para gerar:
-- const bcrypt = require('bcrypt');
-- bcrypt.hash('Admin@123', 10).then(hash => console.log(hash));
