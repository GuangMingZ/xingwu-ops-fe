import { z } from 'zod';
import type { AppDescriptor, SdkDescriptor } from '@xingwu/types';

// ── Zod Schema ──────────────────────────────────────────────

const NavItemSchema: z.ZodType<import('@xingwu/types').NavItem> = z.object({
  key: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  order: z.number().optional(),
  children: z.lazy(() => z.array(NavItemSchema)).optional(),
});

const UiComponentDeclSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  slot: z.string(),
  propsSchema: z.record(z.unknown()).optional(),
});

const AppDescriptorSchema = z.object({
  name: z.string(),
  version: z.string(),
  entry: z.string(),
  routePrefix: z.string(),
  dependencies: z.array(z.string()).optional(),
  navItem: NavItemSchema.optional(),
  configSchema: z.record(z.unknown()).optional(),
  integrity: z.string().optional(),
  dependencyRanges: z.record(z.string()).optional(),
});

const SdkDescriptorSchema = z.object({
  name: z.string(),
  version: z.string(),
  entry: z.string(),
  dependencies: z.array(z.string()).optional(),
  exports: z.array(z.string()).optional(),
  preload: z.boolean().optional(),
  uiComponents: z.array(UiComponentDeclSchema).optional(),
  styleStrategy: z.enum(['css-modules', 'css-in-js', 'shadow-dom']).optional(),
  configSchema: z.record(z.unknown()).optional(),
  integrity: z.string().optional(),
  dependencyRanges: z.record(z.string()).optional(),
});

// ── 开发态 entry 覆盖 ──────────────────────────────────────

/** 开发态：JSON 中 entry 为生产路径时，覆盖为本地 Vite dev server */
const DEV_ENTRY_OVERRIDES: Record<string, string> = {
  product: 'http://localhost:5174/src/index.tsx',
  'auth-guard': 'http://localhost:5175/src/index.ts',
  'region-selector': 'http://localhost:5176/src/index.tsx',
};

function resolveDevEntry<T extends { name: string; entry: string }>(item: T): T {
  if (!import.meta.env.DEV) return item;
  const override = DEV_ENTRY_OVERRIDES[item.name];
  return override ? { ...item, entry: override } : item;
}

// ── JSON 加载与校验 ────────────────────────────────────────

async function loadJsonList<T>(
  source: T[] | string,
  label: string,
  schema: z.ZodArray<z.ZodTypeAny>,
): Promise<T[]> {
  if (Array.isArray(source)) {
    const parsed = schema.safeParse(source);
    if (!parsed.success) {
      throw new Error(`[Xingwu] Invalid ${label} config: ${parsed.error.message}`);
    }
    return source;
  }
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`[Xingwu] Failed to load ${label} from ${source}: ${response.status}`);
  }
  const data: unknown = await response.json();
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`[Xingwu] Invalid ${label} config from ${source}: ${parsed.error.message}`);
  }
  return parsed.data as T[];
}

// ── 导出 ────────────────────────────────────────────────────

export interface LoadedPluginConfig {
  apps: AppDescriptor[];
  sdks: SdkDescriptor[];
  preloadSdkNames: string[];
}

/** 加载子应用与 SDK 配置（支持内联数组或 JSON URL） */
export async function loadPluginConfig(plugins: {
  apps: AppDescriptor[] | string;
  sdks: SdkDescriptor[] | string;
  preloadSdks?: string[];
}): Promise<LoadedPluginConfig> {
  const [appsRaw, sdksRaw] = await Promise.all([
    loadJsonList<AppDescriptor>(plugins.apps, 'apps', z.array(AppDescriptorSchema)),
    loadJsonList<SdkDescriptor>(plugins.sdks, 'sdks', z.array(SdkDescriptorSchema)),
  ]);

  const apps = appsRaw.map(resolveDevEntry);
  const sdks = sdksRaw.map(resolveDevEntry);

  const preloadSdkNames =
    plugins.preloadSdks ?? sdks.filter((s) => s.preload).map((s) => s.name);

  return { apps, sdks, preloadSdkNames };
}
