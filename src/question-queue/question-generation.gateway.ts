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

// ============================================
// SOCKET.IO GATEWAY: Real-time question generation notifications
// ============================================
// Frontend connects to the Socket.IO server and receives events when
// background question generation jobs complete. The socket is joined to
// a room per user ID so notifications are targeted to the right user.
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
export class QuestionGenerationGateway
    implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(QuestionGenerationGateway.name);

    @WebSocketServer()
    server!: Server;

    constructor(private readonly jwtService: JwtService) { }

    // ============================================
    // AUTHENTICATE + JOIN USER ROOM ON CONNECTION
    // ============================================
    async handleConnection(client: Socket) {
        try {
            const token = this.extractTokenFromCookie(client);

            if (!token) {
                this.logger.warn(
                    `Socket connection rejected: no access token (socket ${client.id})`,
                );
                client.disconnect(true);
                return;
            }

            const payload = this.verifyToken(token);
            if (!payload) {
                this.logger.warn(
                    `Socket connection rejected: invalid token (socket ${client.id})`,
                );
                client.disconnect(true);
                return;
            }

            const socketUser: SocketUser = {
                userId: payload.sub || payload.userId || payload.id,
                email: payload.email,
            };

            // Join a personal room so we can emit targeted notifications
            await client.join(`user:${socketUser.userId}`);

            // Attach user to socket data for later access
            client.data.user = socketUser;

            this.logger.log(
                `Socket connected: ${client.id} (user: ${socketUser.userId})`,
            );
        } catch (error: any) {
            this.logger.error(`Socket connection error: ${error.message}`);
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Socket disconnected: ${client.id}`);
    }

    // ============================================
    // CLIENT-SIDE: Join a specific job room to get status updates
    // ============================================
    @SubscribeMessage('job:join')
    async handleJobJoin(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { jobId: string },
    ) {
        if (!payload || !payload.jobId) return;

        // Validate this user owns the job
        const user = client.data.user as SocketUser | undefined;
        if (!user) {
            client.emit('error', { message: 'Not authenticated' });
            return;
        }

        // Join a room scoped to the job
        await client.join(`job:${payload.jobId}`);
        this.logger.log(
            `User ${user.userId} joined job room: job:${payload.jobId}`,
        );
        client.emit('job:joined', { jobId: payload.jobId });
    }

    @SubscribeMessage('job:leave')
    async handleJobLeave(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { jobId: string },
    ) {
        if (payload && payload.jobId) {
            await client.leave(`job:${payload.jobId}`);
        }
    }

    // ============================================
    // EMITTERS (called by processor / service)
    // ============================================

    /**
     * Emit a notification that a generation job has been queued.
     */
    emitJobQueued(userId: string, data: { jobId: string; status: string; message: string }) {
        this.server.to(`user:${userId}`).emit('generation:queued', data);
    }

    /**
     * Emit a notification that a generation job is now processing.
     */
    emitJobProcessing(userId: string, data: { jobId: string; status: string; message: string }) {
        this.server.to(`user:${userId}`).emit('generation:processing', data);
    }

    /**
     * Emit a notification that a generation job has completed.
     * Includes the generated question IDs so the frontend can fetch them from the DB.
     */
    emitJobCompleted(
        userId: string,
        data: {
            jobId: string;
            status: 'completed';
            message: string;
            questionIds: string[];
            questionCount: number;
            sourceType?: string;
        },
    ) {
        // Emit to both the user's personal room and the job room
        this.server.to(`user:${userId}`).emit('generation:completed', data);
        this.server.to(`job:${data.jobId}`).emit('generation:completed', data);
    }

    /**
     * Emit a notification that a generation job has failed.
     */
    emitJobFailed(
        userId: string,
        data: {
            jobId: string;
            status: 'failed';
            message: string;
            error?: string;
        },
    ) {
        this.server.to(`user:${userId}`).emit('generation:failed', data);
        this.server.to(`job:${data.jobId}`).emit('generation:failed', data);
    }

    // ============================================
    // HELPER: Extract & verify JWT from cookie
    // ============================================
    private extractTokenFromCookie(client: Socket): string | null {
        const cookieHeader = client.handshake.headers.cookie;
        if (!cookieHeader) return null;

        // Parse cookie header manually (format: "key=value; key2=value2")
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
            // Use the same secret as the auth module
            const payload = this.jwtService.verify(token);
            return payload;
        } catch {
            return null;
        }
    }
}
