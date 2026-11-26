import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { readRequestMeta } from "../../common/http/request-meta";
import type { AuthUser } from "../../common/types/auth-user";
import { AuthService } from "./auth.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshCookieService } from "./refresh-cookie.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookies: RefreshCookieService,
  ) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const session = await this.authService.login(dto.email, dto.password, requestMeta(request));
    this.cookies.set(response, session.refreshRaw, session.refreshMaxAgeMs);
    return toAuthResponse(session.accessToken, session.expiresIn, session.user);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const session = await this.authService.refresh(this.cookies.read(request), requestMeta(request));
    this.cookies.set(response, session.refreshRaw, session.refreshMaxAgeMs);
    return toAuthResponse(session.accessToken, session.expiresIn, session.user);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.authService.logout(this.cookies.read(request));
    this.cookies.clear(response);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  @Post("change-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.authService.changePassword(user, dto.currentPassword, dto.newPassword, requestMeta(request));
  }
}

function requestMeta(request: Request) {
  return readRequestMeta(request);
}

function toAuthResponse(accessToken: string, expiresIn: number, user: AuthUser) {
  return { accessToken, expiresIn, user };
}
