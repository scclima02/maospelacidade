import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RelatoriosService } from './relatorios.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, RelatoriosService],
})
export class AdminModule {}
