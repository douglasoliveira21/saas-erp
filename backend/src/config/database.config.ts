import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { env } from './env.config';
import { SnakeNamingStrategy } from './snake-naming.strategy';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  createTypeOrmOptions(): TypeOrmModuleOptions {
    const isSupabase = env.database.host.includes('supabase.com') || env.database.host.includes('supabase.co');
    const useSSL = isSupabase || process.env.DATABASE_SSL === 'true';
    const shouldSync = process.env.DATABASE_SYNC === 'true' || env.server.nodeEnv === 'development';

    return {
      type: 'postgres',
      host: env.database.host,
      port: env.database.port,
      username: env.database.username,
      password: env.database.password,
      database: env.database.database,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: shouldSync,
      logging: env.server.nodeEnv === 'development',
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      poolSize: 10,
      extra: isSupabase ? {
        options: '-c search_path=public',
      } : {},
      namingStrategy: new SnakeNamingStrategy(),
      retryAttempts: 5,
      retryDelay: 3000,
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
