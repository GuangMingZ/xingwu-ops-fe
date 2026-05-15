import type { I18n, I18nConfig } from '@xingwu/types';

const defaultFallbackMap: Record<string, string> = {
  en: 'zh',
  intl: 'en',
  ko: 'intl',
  jp: 'intl',
};

/**
 * I18n — 国际化接口实现
 */
export class I18nImpl implements I18n {
  private _locale: string;
  private supportedLocales: string[];
  private fallbackMap: Record<string, string>;
  private translations: Map<string, Record<string, string>> = new Map();

  constructor(config: I18nConfig) {
    this._locale = config.defaultLocale;
    this.supportedLocales = config.supportedLocales;
    this.fallbackMap = config.fallbackMap || defaultFallbackMap;
  }

  get locale(): string {
    return this._locale;
  }

  t(key: string, params?: Record<string, unknown>): string {
    const dict = this.translations.get(this._locale);
    let text = dict?.[key] || key;

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }

    return text;
  }

  setLocale(locale: string): void {
    if (this.supportedLocales.includes(locale)) {
      this._locale = locale;
    } else if (this.fallbackMap[locale]) {
      this._locale = this.fallbackMap[locale];
    }
  }

  /** 注册翻译字典 */
  registerTranslations(locale: string, dict: Record<string, string>): void {
    this.translations.set(locale, { ...this.translations.get(locale), ...dict });
  }
}
