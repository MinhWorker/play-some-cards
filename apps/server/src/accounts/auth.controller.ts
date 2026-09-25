import { BadRequestException, Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { AccountError, AccountsService } from './accounts.service.js';

/** Register / login over HTTP; the returned token then authenticates the socket. */
@Controller('api/auth')
export class AuthController {
  constructor(private readonly accounts: AccountsService) {}

  @Post('register')
  register(@Body() body: unknown) {
    return this.run(() => this.accounts.register(body));
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown) {
    return this.run(() => this.accounts.login(body));
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Headers('authorization') auth = '') {
    await this.accounts.logout(auth.replace(/^Bearer /, ''));
    return { ok: true };
  }

  /** Account errors become 400 `{ message }` (Vietnamese, shown to the player). */
  private async run<T>(fn: () => Promise<T>) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof AccountError) throw new BadRequestException(err.message);
      throw err;
    }
  }
}
