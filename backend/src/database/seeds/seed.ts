import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { dataSourceOptions } from '../../config/database.config';
import { User } from '../../modules/users/entities/user.entity';
import { Customer } from '../../modules/customers/entities/customer.entity';
import { Product } from '../../modules/products/entities/product.entity';
import { Service } from '../../modules/services/entities/service.entity';
import { UserRole } from '../../common/enums/user-role.enum';

async function seed() {
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  console.log('🌱 Iniciando seed do banco de dados...');

  // Usuários
  const userRepository = dataSource.getRepository(User);
  const existingUsers = await userRepository.count();

  if (existingUsers === 0) {
    console.log('📝 Criando usuários...');
    
    const users = [
      {
        name: 'Administrador',
        email: 'admin@empresa.com',
        password: await bcrypt.hash('Admin@123', 10),
        role: UserRole.ADMIN,
      },
      {
        name: 'Maria Financeiro',
        email: 'financeiro@empresa.com',
        password: await bcrypt.hash('Financeiro@123', 10),
        role: UserRole.FINANCEIRO,
      },
      {
        name: 'João Técnico',
        email: 'tecnico@empresa.com',
        password: await bcrypt.hash('Tecnico@123', 10),
        role: UserRole.TECNICO,
      },
      {
        name: 'Pedro Técnico',
        email: 'pedro@empresa.com',
        password: await bcrypt.hash('Tecnico@123', 10),
        role: UserRole.TECNICO,
      },
    ];

    await userRepository.save(users);
    console.log('✅ Usuários criados com sucesso!');
  }

  // Clientes
  const customerRepository = dataSource.getRepository(Customer);
  const existingCustomers = await customerRepository.count();

  if (existingCustomers === 0) {
    console.log('📝 Criando clientes...');
    
    const customers = [
      {
        name: 'Cliente Exemplo 1',
        cpfCnpj: '123.456.789-00',
        phone: '(11) 98765-4321',
        email: 'cliente1@email.com',
        address: 'Rua Exemplo, 123 - São Paulo/SP',
      },
      {
        name: 'Empresa XYZ Ltda',
        cpfCnpj: '12.345.678/0001-90',
        phone: '(11) 3456-7890',
        email: 'contato@empresaxyz.com',
        address: 'Av. Paulista, 1000 - São Paulo/SP',
      },
      {
        name: 'Cliente Exemplo 2',
        cpfCnpj: '987.654.321-00',
        phone: '(11) 91234-5678',
        email: 'cliente2@email.com',
        address: 'Rua Teste, 456 - São Paulo/SP',
      },
    ];

    await customerRepository.save(customers);
    console.log('✅ Clientes criados com sucesso!');
  }

  // Produtos
  const productRepository = dataSource.getRepository(Product);
  const existingProducts = await productRepository.count();

  if (existingProducts === 0) {
    console.log('📝 Criando produtos...');
    
    const products = [
      {
        name: 'Memória RAM DDR4 8GB',
        code: 'RAM-DDR4-8GB',
        category: 'Memória',
        quantity: 50,
        purchasePrice: 150.00,
        salePrice: 250.00,
        taxPercentage: 18.00,
        supplier: 'Fornecedor A',
        minStock: 10,
      },
      {
        name: 'SSD 240GB SATA',
        code: 'SSD-240GB',
        category: 'Armazenamento',
        quantity: 30,
        purchasePrice: 180.00,
        salePrice: 300.00,
        taxPercentage: 18.00,
        supplier: 'Fornecedor A',
        minStock: 5,
      },
      {
        name: 'HD 1TB SATA',
        code: 'HD-1TB',
        category: 'Armazenamento',
        quantity: 25,
        purchasePrice: 200.00,
        salePrice: 350.00,
        taxPercentage: 18.00,
        supplier: 'Fornecedor B',
        minStock: 5,
      },
      {
        name: 'Cooler para Processador',
        code: 'COOLER-CPU',
        category: 'Refrigeração',
        quantity: 40,
        purchasePrice: 50.00,
        salePrice: 100.00,
        taxPercentage: 18.00,
        supplier: 'Fornecedor C',
        minStock: 10,
      },
      {
        name: 'Fonte 500W',
        code: 'FONTE-500W',
        category: 'Fonte',
        quantity: 20,
        purchasePrice: 150.00,
        salePrice: 280.00,
        taxPercentage: 18.00,
        supplier: 'Fornecedor A',
        minStock: 5,
      },
    ];

    await productRepository.save(products);
    console.log('✅ Produtos criados com sucesso!');
  }

  // Serviços
  const serviceRepository = dataSource.getRepository(Service);
  const existingServices = await serviceRepository.count();

  if (existingServices === 0) {
    console.log('📝 Criando serviços...');
    
    const services = [
      {
        name: 'Formatação Completa',
        description: 'Formatação do sistema operacional com instalação de drivers',
        salePrice: 150.00,
        operationalCost: 20.00,
        taxPercentage: 10.00,
        estimatedTime: 120,
      },
      {
        name: 'Backup de Dados',
        description: 'Backup completo de arquivos e documentos',
        salePrice: 100.00,
        operationalCost: 15.00,
        taxPercentage: 10.00,
        estimatedTime: 60,
      },
      {
        name: 'Limpeza Interna',
        description: 'Limpeza física interna do computador',
        salePrice: 80.00,
        operationalCost: 10.00,
        taxPercentage: 10.00,
        estimatedTime: 45,
      },
      {
        name: 'Manutenção Preventiva',
        description: 'Manutenção preventiva completa do equipamento',
        salePrice: 120.00,
        operationalCost: 15.00,
        taxPercentage: 10.00,
        estimatedTime: 90,
      },
      {
        name: 'Suporte Remoto',
        description: 'Suporte técnico remoto',
        salePrice: 80.00,
        operationalCost: 5.00,
        taxPercentage: 10.00,
        estimatedTime: 60,
      },
    ];

    await serviceRepository.save(services);
    console.log('✅ Serviços criados com sucesso!');
  }

  console.log('🎉 Seed concluído com sucesso!');
  console.log('\n📋 Usuários criados:');
  console.log('Admin: admin@empresa.com / Admin@123');
  console.log('Financeiro: financeiro@empresa.com / Financeiro@123');
  console.log('Técnico: tecnico@empresa.com / Tecnico@123');

  await dataSource.destroy();
}

seed().catch((error) => {
  console.error('❌ Erro ao executar seed:', error);
  process.exit(1);
});
