import { Module } from '@nestjs/common';
import { ParticipacoesController } from './participacoes.controller';
import { ParticipacoesService } from './participacoes.service';

@Module({
  controllers: [ParticipacoesController],
  providers: [ParticipacoesService],
})
export class ParticipacoesModule {}
