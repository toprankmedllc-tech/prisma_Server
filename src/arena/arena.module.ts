import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ArenaController } from './arena.controller';
import { ArenaService } from './arena.service';
import { ArenaGateway } from './arena.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET', 'access-secret'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  controllers: [ArenaController],
  providers: [ArenaService, ArenaGateway],
  exports: [ArenaService],
})
export class ArenaModule { }