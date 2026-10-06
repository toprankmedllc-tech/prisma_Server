import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL ,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { name, emails, photos } = profile;
      const email = emails[0].value;
      const firstName = name?.givenName || '';
      const lastName = name?.familyName || '';
      const avatar = photos?.[0]?.value || '';

      this.logger.log(`Google OAuth attempt for email: ${email}`);

      const user = await this.authService.findOrCreateGoogleUser({
        email,
        firstName,
        lastName,
        avatar,
      });

      return done(null, user);
    } catch (error : any) {
      this.logger.error(`Google OAuth error: ${error.message}`);
      return done(error as any, false);
    }
  }
}