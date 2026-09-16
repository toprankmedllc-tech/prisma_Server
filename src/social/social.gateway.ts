import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PresenceService, FriendsService } from './friends.service';
import { ChatService } from './chat.service';
import { GuildChatService } from './guild-chat.service';

interface SocketUser {
    userId: string;
    email: string;
}

@WebSocketGateway({
    cors: {
        origin: [
            'https://staging-test.toprankmd.com',
            'https://usmle-review.vercel.app',
            'http://localhost:3000',
            'http://localhost:3001',
        ],
        credentials: true,
    },
    namespace: '/',
})
export class SocialGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(SocialGateway.name);

    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly jwtService: JwtService,
        private readonly presence: PresenceService,
        private readonly friendsService: FriendsService,
        private readonly chatService: ChatService,
        private readonly guildChatService: GuildChatService,
    ) { }

    async handleConnection(client: Socket) {
        try {
            const token = this.extractTokenFromCookie(client);
            if (!token) {
                client.disconnect(true);
                return;
            }
            const payload = this.verifyToken(token);
            if (!payload) {
                client.disconnect(true);
                return;
            }
            const socketUser: SocketUser = {
                userId: payload.sub || payload.userId || payload.id,
                email: payload.email,
            };
            await client.join(`user:${socketUser.userId}`);
            client.data.user = socketUser;

            // Mark online and notify friends.
            this.presence.add(socketUser.userId);
            this.notifyFriendsPresence(socketUser.userId, true);

            this.logger.log(`Social socket connected: ${client.id} (user: ${socketUser.userId})`);
        } catch (error: any) {
            this.logger.error(`Social socket connection error: ${error.message}`);
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        const user = client.data.user as SocketUser | undefined;
        if (user) {
            this.presence.remove(user.userId);
            this.notifyFriendsPresence(user.userId, false);
        }
        this.logger.log(`Social socket disconnected: ${client.id}`);
    }

    // ============================================
    // SEND A CHAT MESSAGE (real-time)
    // ============================================
    @SubscribeMessage('chat:send')
    async handleChatSend(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { receiverId: string; content: string },
    ) {
        const user = client.data.user as SocketUser | undefined;
        if (!user || !payload?.receiverId || !payload?.content) {
            client.emit('chat:error', { message: 'Invalid message payload' });
            return;
        }
        try {
            const message = await this.chatService.sendMessage(user.userId, payload.receiverId, payload.content);
            // Deliver to the receiver's room and echo back to the sender.
            this.server.to(`user:${payload.receiverId}`).emit('chat:message', message);
            client.emit('chat:message', message);
        } catch (error: any) {
            client.emit('chat:error', { message: error.message || 'Failed to send message' });
        }
    }

    // ============================================
    // MARK MESSAGES AS READ
    // ============================================
    @SubscribeMessage('chat:read')
    async handleChatRead(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { otherId: string },
    ) {
        const user = client.data.user as SocketUser | undefined;
        if (!user || !payload?.otherId) return;
        await this.chatService.markRead(user.userId, payload.otherId);
        // Notify the sender that their messages were read.
        this.server.to(`user:${payload.otherId}`).emit('chat:read', { byUserId: user.userId });
    }

    // ============================================
    // SEND A GUILD CHAT MESSAGE (real-time)
    // ============================================
    @SubscribeMessage('guild-chat:send')
    async handleGuildChatSend(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { guildId: string; content: string },
    ) {
        const user = client.data.user as SocketUser | undefined;
        if (!user || !payload?.guildId || !payload?.content) {
            client.emit('chat:error', { message: 'Invalid guild message payload' });
            return;
        }
        try {
            const message = await this.guildChatService.sendGuildMessage(user.userId, payload.guildId, payload.content);
            // Broadcast to the guild room.
            this.server.to(`guild:${payload.guildId}`).emit('guild-chat:message', message);
            client.emit('guild-chat:message', message);
        } catch (error: any) {
            client.emit('chat:error', { message: error.message || 'Failed to send guild message' });
        }
    }

    // ============================================
    // JOIN A GUILD ROOM
    // ============================================
    @SubscribeMessage('guild-chat:join')
    async handleGuildChatJoin(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { guildId: string },
    ) {
        const user = client.data.user as SocketUser | undefined;
        if (!user || !payload?.guildId) return;
        await client.join(`guild:${payload.guildId}`);
        client.emit('guild-chat:joined', { guildId: payload.guildId });
    }

    // ============================================
    // HELPER: notify friends of presence change
    // ============================================
    private async notifyFriendsPresence(userId: string, online: boolean) {
        try {
            const friends = await this.friendsService.listFriends(userId);
            for (const friend of friends) {
                this.server.to(`user:${friend.userId}`).emit('presence:update', {
                    userId,
                    online,
                });
            }
        } catch (error: any) {
            this.logger.warn(`Failed to notify presence for ${userId}: ${error.message}`);
        }
    }

    private extractTokenFromCookie(client: Socket): string | null {
        const cookieHeader = client.handshake.headers.cookie;
        if (!cookieHeader) return null;
        const cookies: Record<string, string> = {};
        cookieHeader.split(';').forEach((pair) => {
            const [key, ...valueParts] = pair.trim().split('=');
            if (key) cookies[key] = valueParts.join('=');
        });
        return cookies['access_token'] || null;
    }

    private verifyToken(token: string): any {
        try {
            return this.jwtService.verify(token);
        } catch {
            return null;
        }
    }
}