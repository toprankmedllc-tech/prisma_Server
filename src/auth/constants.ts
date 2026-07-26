export const JWT_CONSTANTS = {
  ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'access-secret',
  REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
  RESET_SECRET: process.env.JWT_RESET_SECRET || 'reset-secret',
  VERIFICATION_SECRET: process.env.JWT_VERIFICATION_SECRET || 'verify-secret',
  ACCESS_EXPIRES_IN: '15m',
  REFRESH_EXPIRES_IN: '7d',
  RESET_EXPIRES_IN: '1h',
  VERIFICATION_EXPIRES_IN: '1d',
};
