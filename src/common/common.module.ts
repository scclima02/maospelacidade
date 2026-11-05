import { Global, Module } from '@nestjs/common';
import { ConfiguracaoService } from './configuracao.service';
import { DatabaseService } from './database.service';
import { GeocodificacaoService } from './geocodificacao.service';
import { MailService } from './mail.service';
import { PdfService } from './pdf.service';

@Global()
@Module({
  providers: [DatabaseService, ConfiguracaoService, MailService, PdfService, GeocodificacaoService],
  exports: [DatabaseService, ConfiguracaoService, MailService, PdfService, GeocodificacaoService],
})
export class CommonModule {}
