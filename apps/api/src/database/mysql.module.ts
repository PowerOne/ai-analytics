import { Global, Module } from "@nestjs/common";
import { MySQLService } from "./mysql.service";

@Global()
@Module({
  providers: [MySQLService],
  exports: [MySQLService],
})
export class MysqlModule {}
