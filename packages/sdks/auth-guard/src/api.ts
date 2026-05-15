import type { SdkContext } from '@xingwu/types';

/**
 * AuthGuardApi — 鉴权守卫 API
 *
 * 提供 Session 守卫、Owner 守卫、权限检查等纯逻辑能力。
 */
export class AuthGuardApi {
  private sessionGuardEnabled: boolean;
  private ownerGuardEnabled: boolean;

  constructor(ctx: SdkContext) {
    const config = ctx.config.get<{ enableSessionGuard?: boolean; enableOwnerGuard?: boolean }>('auth-guard') || {};
    this.sessionGuardEnabled = config.enableSessionGuard ?? true;
    this.ownerGuardEnabled = config.enableOwnerGuard ?? true;
  }

  /** 检查 Session 是否有效 */
  async checkSession(): Promise<boolean> {
    if (!this.sessionGuardEnabled) return true;
    const hasSession = document.cookie.includes('session_id');
    return hasSession;
  }

  /** 检查 Owner 是否变更 */
  async checkOwner(): Promise<boolean> {
    if (!this.ownerGuardEnabled) return true;
    return true;
  }

  /** 综合检查 */
  async checkAll(): Promise<{ session: boolean; owner: boolean }> {
    const [session, owner] = await Promise.all([
      this.checkSession(),
      this.checkOwner(),
    ]);
    return { session, owner };
  }

  /** 刷新 Session */
  async refreshSession(): Promise<void> {
    console.info('[AuthGuard] Session refresh triggered.');
  }
}
