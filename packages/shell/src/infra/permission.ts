import type { PermissionChecker, PermissionConfig, PermissionNode, PermissionResult } from '@xingwu/types';

/**
 * PermissionChecker — 权限检查实现（Deny-by-default）
 *
 * 安全策略：所有检查默认拒绝，必须通过 configure() 或构造参数显式授权。
 * 触发条件：若未传入 PermissionConfig 或配置项缺失，checkAdmin / checkIdentity
 *           均返回 false，checkRbacAction 仅允许 allowedActions 中声明的 action。
 * 与原实现差异：原实现全部 return true（默认放行），存在越权风险；
 *               现采用白名单策略，防止未授权操作悄然通过。
 * 选择该修复方式的原因：权限体系应遵循最小权限原则，
 *   显式声明比隐式信任更安全，且不影响框架的扩展性。
 */
export class PermissionCheckerImpl implements PermissionChecker {
  private isAdmin: boolean;
  private isAuthenticated: boolean;
  private allowedActions: Set<string>;

  constructor(config?: PermissionConfig) {
    this.isAdmin = config?.isAdmin ?? false;
    this.isAuthenticated = config?.isAuthenticated ?? false;
    this.allowedActions = new Set(config?.allowedActions ?? []);
  }

  /** 动态更新权限配置（用于登录完成 / 权限刷新场景） */
  configure(config: PermissionConfig): void {
    if (config.isAdmin !== undefined) {
      this.isAdmin = config.isAdmin;
    }
    if (config.isAuthenticated !== undefined) {
      this.isAuthenticated = config.isAuthenticated;
    }
    if (config.allowedActions !== undefined) {
      this.allowedActions = new Set(config.allowedActions);
    }
  }

  async checkAdmin(): Promise<boolean> {
    return this.isAdmin;
  }

  async checkIdentity(): Promise<boolean> {
    return this.isAuthenticated;
  }

  /** 仅允许 allowedActions 白名单中的 action，其余默认拒绝 */
  async checkRbacAction(action: string): Promise<boolean> {
    return this.allowedActions.has(action);
  }

  async checkChain(chain: PermissionNode[]): Promise<PermissionResult> {
    for (const node of chain) {
      switch (node.type) {
        case 'admin': {
          const result = await this.checkAdmin();
          if (!result) {
            return { granted: false, reason: 'Admin permission denied', node };
          }
          break;
        }
        case 'identity': {
          const result = await this.checkIdentity();
          if (!result) {
            return { granted: false, reason: 'Identity verification failed', node };
          }
          break;
        }
        case 'rbac': {
          const rbacAction = node.config?.action as string;
          if (rbacAction) {
            const result = await this.checkRbacAction(rbacAction);
            if (!result) {
              return { granted: false, reason: `RBAC action "${rbacAction}" denied`, node };
            }
          }
          break;
        }
        case 'custom':
          // 自定义权限由插件自行处理
          break;
      }
    }
    return { granted: true };
  }
}
