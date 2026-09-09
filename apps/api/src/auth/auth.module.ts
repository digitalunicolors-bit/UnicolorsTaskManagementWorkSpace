import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
    JwtModule.register({}),
  ],
  
  controllers: [AuthController],
  providers: [
   AuthService,
  JwtStrategy,
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
],
  exports: [
   AuthService,
  JwtModule,
  PassportModule,
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  ],
})
export class AuthModule {}