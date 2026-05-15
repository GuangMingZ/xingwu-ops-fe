import type { PermissionChecker, PermissionNode, PermissionResult } from '@xingwu/types';

/**
 * PermissionChecker — 权限检查实现（简化版）
 */
export class PermissionCheckerImpl implements PermissionChecker {
  async checkAdmin(): Promise<boolean> {
    // 简化实现，生产环境对接权限服务
    return true;
  }

  async checkIdentity(): Promise<boolean> {
    return true;
  }

  async checkRbacAction(_action: string): Promise<boolean> {
    return true;
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
