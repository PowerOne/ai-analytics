import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  createPool,
  type FieldPacket,
  type Pool,
  type PoolOptions,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

@Injectable()
export class MySQLService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null;

  onModuleInit(): void {
    this.pool = createPool(this.buildPoolOptions());
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async query<TRow extends RowDataPacket[] = RowDataPacket[]>(
    sql: string,
    params?: unknown[],
  ): Promise<[TRow | ResultSetHeader, FieldPacket[]]> {
    if (!this.pool) {
      throw new Error("MySQL pool not initialized");
    }
    if (params !== undefined) {
      return this.pool.query<TRow>(sql, params);
    }
    return this.pool.query<TRow>(sql);
  }

  private buildPoolOptions(): PoolOptions {
    const url = process.env.DATABASE_URL;
    if (url && (url.startsWith("mysql://") || url.startsWith("mysql2://"))) {
      const u = new URL(url);
      const database = u.pathname.replace(/^\//, "").split("?")[0];
      return {
        host: u.hostname,
        port: u.port ? Number(u.port) : 3306,
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      };
    }

    return {
      host: process.env.MYSQL_HOST ?? "127.0.0.1",
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_USER ?? "root",
      password: process.env.MYSQL_PASSWORD ?? "",
      database: process.env.MYSQL_DATABASE ?? "",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };
  }
}
