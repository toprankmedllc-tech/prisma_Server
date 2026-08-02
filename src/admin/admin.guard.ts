import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new UnauthorizedException('User not authenticated');
        }

        // Query the database to check if the user has the ADMIN role
        const dbUser = await this.prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true },
        });

        if (!dbUser || dbUser.role !== 'ADMIN') {
            throw new UnauthorizedException('Admin access required');
        }

        return true;
    }
}