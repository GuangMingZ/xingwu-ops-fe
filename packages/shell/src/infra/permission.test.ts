/**
 * PermissionCheckerImpl — 默认拒绝策略单元测试 (P0-2)
 *
 * 覆盖场景：
 *  1. 未传入 config → 所有检查均返回 false（deny-by-default）
 *  2. 传入 isAdmin: true → checkAdmin() 返回 true
 *  3. 传入 allowedActions → checkRbacAction 仅允许白名单动作
 *  4. configure() 动态更新后，权限立即生效
 *  5. checkChain() 链式校验失败时返回 granted: false 及具体 reason
 *  6. checkChain() 全部通过时返回 granted: true
 */
import { describe, expect, it } from 'vitest';
import { PermissionCheckerImpl } from '@/infra/permission';

describe('PermissionCheckerImpl — 默认拒绝策略 (P0-2)', () => {
  it('未配置时所有检查均返回 false（deny-by-default）', async () => {
    const checker = new PermissionCheckerImpl();
    await expect(checker.checkAdmin()).resolves.toBe(false);
    await expect(checker.checkIdentity()).resolves.toBe(false);
    await expect(checker.checkRbacAction('any:action')).resolves.toBe(false);
  });

  it('isAdmin: true → checkAdmin() 返回 true', async () => {
    const checker = new PermissionCheckerImpl({ isAdmin: true });
    await expect(checker.checkAdmin()).resolves.toBe(true);
    // 其他检查不受影响
    await expect(checker.checkIdentity()).resolves.toBe(false);
  });

  it('isAuthenticated: true → checkIdentity() 返回 true', async () => {
    const checker = new PermissionCheckerImpl({ isAuthenticated: true });
    await expect(checker.checkIdentity()).resolves.toBe(true);
    await expect(checker.checkAdmin()).resolves.toBe(false);
  });

  it('allowedActions 白名单 → 只有白名单内的 action 通过', async () => {
    const checker = new PermissionCheckerImpl({
      allowedActions: ['order:read', 'order:create'],
    });
    await expect(checker.checkRbacAction('order:read')).resolves.toBe(true);
    await expect(checker.checkRbacAction('order:create')).resolves.toBe(true);
    await expect(checker.checkRbacAction('order:delete')).resolves.toBe(false);
    await expect(checker.checkRbacAction('admin:all')).resolves.toBe(false);
  });

  it('configure() 动态更新权限立即生效', async () => {
    const checker = new PermissionCheckerImpl();
    await expect(checker.checkAdmin()).resolves.toBe(false);

    checker.configure({ isAdmin: true, isAuthenticated: true, allowedActions: ['user:read'] });
    await expect(checker.checkAdmin()).resolves.toBe(true);
    await expect(checker.checkIdentity()).resolves.toBe(true);
    await expect(checker.checkRbacAction('user:read')).resolves.toBe(true);
    await expect(checker.checkRbacAction('user:write')).resolves.toBe(false);
  });

  it('configure() 部分更新：只修改传入字段', async () => {
    const checker = new PermissionCheckerImpl({ isAdmin: true, allowedActions: ['a'] });
    checker.configure({ isAuthenticated: true });
    // isAdmin 未被覆盖，仍为 true
    await expect(checker.checkAdmin()).resolves.toBe(true);
    await expect(checker.checkIdentity()).resolves.toBe(true);
    // allowedActions 未被覆盖
    await expect(checker.checkRbacAction('a')).resolves.toBe(true);
  });

  describe('checkChain()', () => {
    it('admin 节点失败 → granted: false，reason 含 Admin', async () => {
      const checker = new PermissionCheckerImpl(); // isAdmin = false
      const result = await checker.checkChain([{ type: 'admin' }]);
      expect(result.granted).toBe(false);
      expect(result.reason).toMatch(/Admin/);
    });

    it('identity 节点失败 → granted: false，reason 含 Identity', async () => {
      const checker = new PermissionCheckerImpl();
      const result = await checker.checkChain([{ type: 'identity' }]);
      expect(result.granted).toBe(false);
      expect(result.reason).toMatch(/Identity/);
    });

    it('rbac 节点失败 → granted: false，reason 含 action 名称', async () => {
      const checker = new PermissionCheckerImpl();
      const result = await checker.checkChain([
        { type: 'rbac', config: { action: 'report:export' } },
      ]);
      expect(result.granted).toBe(false);
      expect(result.reason).toMatch(/report:export/);
    });

    it('全部节点通过 → granted: true', async () => {
      const checker = new PermissionCheckerImpl({
        isAdmin: true,
        isAuthenticated: true,
        allowedActions: ['report:export'],
      });
      const result = await checker.checkChain([
        { type: 'admin' },
        { type: 'identity' },
        { type: 'rbac', config: { action: 'report:export' } },
      ]);
      expect(result.granted).toBe(true);
    });

    it('custom 节点始终跳过（由插件自行处理）', async () => {
      const checker = new PermissionCheckerImpl();
      const result = await checker.checkChain([{ type: 'custom' }]);
      // custom 节点不拦截，链结束后 granted: true
      expect(result.granted).toBe(true);
    });
  });
});
