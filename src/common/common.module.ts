import { Global, Module } from '@nestjs/common';
import { ConfiguracaoService } from './configuracao.service';
import { DatabaseService } from './database.service';
import { MailService } from './mail.service';
import { PdfService } from './pdf.service';

@Global()
@Module({
  providers: [DatabaseService, ConfiguracaoService, MailService, PdfService],
  exports: [DatabaseService, ConfiguracaoService, MailService, PdfService],
})
export class CommonModule {}
