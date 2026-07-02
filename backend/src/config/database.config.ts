import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { env } from './env.config';
import { SnakeNamingStrategy } from './snake-naming.strategy';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: env.database.host,
      port: env.database.port,
      username: env.database.username,
      password: env.database.password,
      database: env.database.database,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: false,
      logging: env.server.nodeEnv === 'development',
      ssl: env.database.host.includes('supabase.com') || env.database.host.includes('supabase.co') ? {
        rejectUnauthorized: false
      } : false,
      poolSize: 10,
      extra: env.database.host.includes('pooler.supabase.com') ? {
        options: '-c search_path=public',
      } : {},
      namingStrategy: new SnakeNamingStrategy(),
    };
  }
}

// DataSource for migrations
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: env.database.host,
  port: env.database.port,
  username: env.database.username,
  password: env.database.password,
  database: env.database.database,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false,
  ssl: env.database.host.includes('supabase.com') || env.database.host.includes('supabase.co') ? {
    rejectUnauthorized: false
  } : false,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
