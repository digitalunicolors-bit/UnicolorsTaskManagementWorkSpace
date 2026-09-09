import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TasksModule } from '../tasks/tasks.module';

import { VoiceNotesController } from './voice-notes.controller';
import { VoiceNotesService } from './voice-notes.service';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    TasksModule,
  ],
  controllers: [
    VoiceNotesController,
  ],
  providers: [
    VoiceNotesService,
  ],
  exports: [
    VoiceNotesService,
  ],
})
export class VoiceNotesModule {}
