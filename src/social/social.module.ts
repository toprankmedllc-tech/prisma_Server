import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FriendsController } from './friends.controller';
import { ChatController } from './chat.controller';
import { GuildChatController } from './guild-chat.controller';
import { FriendsService, PresenceService } from './friends.service';
import { ChatService } from './chat.service';
import { GuildChatService } from './guild-chat.service';
import { SocialGateway } from './social.gateway';
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
  controllers: [FriendsController, ChatController, GuildChatController],
  providers: [FriendsService, PresenceService, ChatService, GuildChatService, SocialGateway],
  exports: [FriendsService, PresenceService, ChatService, GuildChatService],
})
export class SocialModule { }