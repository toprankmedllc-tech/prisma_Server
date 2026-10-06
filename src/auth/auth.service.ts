import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (existingUser) {
      throw new BadRequestException(
    "User already exists"
  );
    }

    // Validate that terms and privacy are accepted
    if (!dto.acceptedTerms) {
      throw new BadRequestException('You must accept the terms and conditions');
    }
    if (!dto.acceptedPrivacy) {
      throw new BadRequestException('You must accept the privacy policy');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        studentType: dto.studentType,
        targetExam: dto.targetExam,
        targetTestDate: dto.targetTestDate ? new Date(dto.targetTestDate) : null,
        acceptedTerms: dto.acceptedTerms,
        acceptedPrivacy: dto.acceptedPrivacy,
        role: 'STUDENT',
        isActive: true,
      }
    });

    return {
      status: "success",
      data: user,
      message: "User registered successfully",
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        studentType: true,
        targetExam: true,
        targetTestDate: true,
        emailVerifiedAt: true,
        role: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid email or password');
    }

    // Use a 7-day access token for the simple session-based frontend flow.
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      { 
        secret: process.env.JWT_ACCESS_SECRET || 'access-secret',
        expiresIn: '7d',
      }
    );

    return {
      access_token: accessToken,
      user,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const decoded = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      });
      
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          emailVerifiedAt: true,
        }
      });
      
      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }

      const newAccessToken = await this.jwtService.signAsync(
        { sub: user.id, email: user.email },
        { 
          secret: process.env.JWT_ACCESS_SECRET || 'access-secret',
          expiresIn: '30d',
        }
      );

      // Optionally rotate refresh token
      const newRefreshToken = await this.jwtService.signAsync(
        { sub: user.id, email: user.email },
        {
          secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
          expiresIn: '30d',
        }
      );
      
      return { access_token: newAccessToken, refresh_token: newRefreshToken, user };
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async resetPassword(email: string, token: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Invalid reset request');
    }
    
    try {
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_RESET_SECRET || 'reset-secret',
      });
      if (decoded.sub !== user.id) {
        throw new BadRequestException('Invalid token');
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashed },
      });
      return { message: 'Password has been reset successfully' };
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }
  }

  async verifyEmail(token: string) {
    try {
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_VERIFICATION_SECRET || 'verify-secret',
      });
      await this.prisma.user.update({
        where: { id: decoded.sub },
        data: { 
          emailVerifiedAt: new Date(),
          isActive: true 
        },
      });
      return { message: `Email verified successfully. User ${decoded.sub} is now active.` };
    } catch {
      throw new BadRequestException('Invalid or expired verification token');
    }
  }

  async sendResetPasswordEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether user exists
      return { message: 'If an account exists, a reset link has been sent' };
    }

    const token = await this.jwtService.signAsync(
      { sub: user.id },
      {
        secret: process.env.JWT_RESET_SECRET || 'reset-secret',
        expiresIn: '1h'
      }
    );

    // Send the reset password email
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    await this.emailService.sendResetPasswordEmail(email, resetLink);

    return { message: 'Reset link sent if account exists' };
  }

  async logout(id: string) {
    // In a real implementation, you might:
    // 1. Add token to a blacklist
    // 2. Track logged out tokens until they expire
    // 3. Clear refresh tokens if using them
    
    // For now we'll just return success message
    return { message: 'Logout successful' };
  }

  async getMyProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        firstName: true,
        lastName: true,
        studentType: true,
        targetExam: true,
        targetTestDate: true,
      }
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      id: user.id,
      role: user.role,
      studentType: user.studentType,
      targetExam: user.targetExam,
      targetTestDate: user.targetTestDate,
      emailVerifiedAt: user.emailVerifiedAt
    };
  }

  async findOrCreateGoogleUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }) {
    // Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { email: data.email }
    });

    if (user) {
      // Update name/avatar if missing
      const updates: any = {};
      if (!user.firstName && data.firstName) {
        updates.firstName = data.firstName;
      }
      if (!user.lastName && data.lastName) {
        updates.lastName = data.lastName;
      }
      
      if (Object.keys(updates).length > 0) {
        user = await this.prisma.user.update({
          where: { email: data.email },
          data: updates,
        });
      }
      
      return user;
    }

    // Create new user with Google data
    user = await this.prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash: '', // No password for Google users
        role: 'STUDENT',
        isActive: true,
        acceptedTerms: false, // Will need to prompt
        acceptedPrivacy: false,
      }
    });

    return user;
  }

  async generateAccessToken(userId: string, email: string) {
    return this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: process.env.JWT_ACCESS_SECRET || 'access-secret',
        expiresIn: '30d',
      }
    );
  }

  async generateRefreshToken(userId: string, email: string) {
    return this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
        expiresIn: '30d',
      }
    );
  }
}
