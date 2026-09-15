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
import { ArenaService } from './arena.service';

// ============================================
// SOCKET.IO GATEWAY: Real-time Arena battles
// ============================================
// Handles matchmaking, live battle events, and real-time answer submission.
// Users are joined to a personal room (`user:<id>`) and a battle room
// (`battle:<id>`) so events are targeted correctly.
// ============================================

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
export class ArenaGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(ArenaGateway.name);

    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly jwtService: JwtService,
        private readonly arenaService: ArenaService,
    ) { }

    // ============================================
    // AUTHENTICATE + JOIN USER ROOM ON CONNECTION
    // ============================================
    async handleConnection(client: Socket) {
        try {
            const token = this.extractTokenFromCookie(client);
            if (!token) {
                this.logger.warn(`Arena socket rejected: no access token (${client.id})`);
                client.disconnect(true);
                return;
            }

            const payload = this.verifyToken(token);
            if (!payload) {
                this.logger.warn(`Arena socket rejected: invalid token (${client.id})`);
                client.disconnect(true);
                return;
            }

            const socketUser: SocketUser = {
                userId: payload.sub || payload.userId || payload.id,
                email: payload.email,
            };

            await client.join(`user:${socketUser.userId}`);
            client.data.user = socketUser;

            this.logger.log(`Arena socket connected: ${client.id} (user: ${socketUser.userId})`);
        } catch (error: any) {
            this.logger.error(`Arena socket connection error: ${error.message}`);
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        const user = client.data.user as SocketUser | undefined;
        if (user) {
            // Remove from matchmaking queue on disconnect.
            this.arenaService.leaveQueue(user.userId);
        }
        this.logger.log(`Arena socket disconnected: ${client.id}`);
    }

    // ============================================
    // JOIN MATCHMAKING QUEUE
    // ============================================
    @SubscribeMessage('arena:join-queue')
    async handleJoinQueue(@ConnectedSocket() client: Socket) {
        const user = client.data.user as SocketUser | undefined;
        if (!user) {
            client.emit('arena:error', { message: 'Not authenticated' });
            return;
        }

        const result = await this.arenaService.joinQueue(user.userId);
        if (result.matched && result.battle) {
            // Emit matched + started to both players.
            this.server.to(`user:${result.battle.player1Id}`).emit('arena:matched', result.battle);
            this.server.to(`user:${result.battle.player2Id}`).emit('arena:matched', result.battle);
            this.server.to(`user:${result.battle.player1Id}`).emit('arena:started', result.battle);
            this.server.to(`user:${result.battle.player2Id}`).emit('arena:started', result.battle);
        } else {
            client.emit('arena:queued', { message: 'Searching for an opponent...' });
        }
    }

    // ============================================
    // LEAVE MATCHMAKING QUEUE
    // ============================================
    @SubscribeMessage('arena:leave-queue')
    async handleLeaveQueue(@ConnectedSocket() client: Socket) {
        const user = client.data.user as SocketUser | undefined;
        if (!user) return;
        this.arenaService.leaveQueue(user.userId);
        client.emit('arena:left-queue', { message: 'Left the queue.' });
    }

    // ============================================
    // JOIN A BATTLE ROOM
    // ============================================
    @SubscribeMessage('arena:join-battle')
    async handleJoinBattle(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { battleId: string },
    ) {
        const user = client.data.user as SocketUser | undefined;
        if (!user || !payload?.battleId) return;
        await client.join(`battle:${payload.battleId}`);
        client.emit('arena:joined-battle', { battleId: payload.battleId });
    }

    // ============================================
    // SUBMIT AN ANSWER IN REAL TIME
    // ============================================
    @SubscribeMessage('arena:answer')
    async handleAnswer(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { battleId: string; questionId: string; selectedChoiceId?: string; timeSpentSec?: number },
    ) {
        const user = client.data.user as SocketUser | undefined;
        if (!user || !payload?.battleId || !payload?.questionId) {
            client.emit('arena:error', { message: 'Invalid answer payload' });
            return;
        }

        try {
            const result = await this.arenaService.submitAnswer(user.userId, payload.battleId, {
                questionId: payload.questionId,
                selectedChoiceId: payload.selectedChoiceId,
                timeSpentSec: payload.timeSpentSec,
            });

            // Notify the opponent that the current user answered.
            const battle = await this.arenaService.getBattle(user.userId, payload.battleId);
            const opponentId = battle.player1Id === user.userId ? battle.player2Id : battle.player1Id;
            this.server.to(`user:${opponentId}`).emit('arena:opponent-answered', {
                battleId: payload.battleId,
                playerId: user.userId,
                player1Score: battle.player1Score,
                player2Score: battle.player2Score,
            });

            client.emit('arena:answer-result', result);
        } catch (error: any) {
            client.emit('arena:error', { message: error.message || 'Failed to submit answer' });
        }
    }

    // ============================================
    // COMPLETE A BATTLE IN REAL TIME
    // ============================================
    @SubscribeMessage('arena:complete')
    async handleComplete(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { battleId: string },
    ) {
        const user = client.data.user as SocketUser | undefined;
        if (!user || !payload?.battleId) return;

        try {
            const result = await this.arenaService.completeBattle(user.userId, payload.battleId);
            this.server.to(`battle:${payload.battleId}`).emit('arena:ended', result);
            this.server.to(`user:${result.player1Id}`).emit('arena:ended', result);
            this.server.to(`user:${result.player2Id}`).emit('arena:ended', result);
        } catch (error: any) {
            client.emit('arena:error', { message: error.message || 'Failed to complete battle' });
        }
    }

    // ============================================
    // EMITTERS (called by service / timers)
    // ============================================
    emitBattleEnded(battleId: string, player1Id: string, player2Id: string, result: any) {
        this.server.to(`battle:${battleId}`).emit('arena:ended', result);
        this.server.to(`user:${player1Id}`).emit('arena:ended', result);
        this.server.to(`user:${player2Id}`).emit('arena:ended', result);
    }

    // ============================================
    // HELPER: Extract & verify JWT from cookie
    // ============================================
    private extractTokenFromCookie(client: Socket): string | null {
        const cookieHeader = client.handshake.headers.cookie;
        if (!cookieHeader) return null;

        const cookies: Record<string, string> = {};
        cookieHeader.split(';').forEach((pair) => {
            const [key, ...valueParts] = pair.trim().split('=');
            if (key) {
                cookies[key] = valueParts.join('=');
            }
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