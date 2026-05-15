import type { NetClient } from '@xingwu/types';

/**
 * NetClient — 网络请求客户端实现
 */
export class NetClientImpl implements NetClient {
  private baseUrl: string;
  private interceptors: Array<{
    request?: (url: string, options: RequestInit) => { url: string; options: RequestInit };
    response?: (response: Response) => Response;
  }> = [];

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  async request<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
    let finalUrl = this.baseUrl + url;
    let finalOptions = options;

    // 执行请求拦截器
    for (const interceptor of this.interceptors) {
      if (interceptor.request) {
        const result = interceptor.request(finalUrl, finalOptions);
        finalUrl = result.url;
        finalOptions = result.options;
      }
    }

    let response = await fetch(finalUrl, finalOptions);

    // 执行响应拦截器
    for (const interceptor of this.interceptors) {
      if (interceptor.response) {
        response = interceptor.response(response);
      }
    }

    if (!response.ok) {
      throw new Error(`[Xingwu] Net request failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async get<T = unknown>(url: string, params?: Record<string, string>): Promise<T> {
    let finalUrl = url;
    if (params) {
      const searchParams = new URLSearchParams(params);
      finalUrl += `?${searchParams.toString()}`;
    }
    return this.request<T>(finalUrl);
  }

  async post<T = unknown>(url: string, body?: unknown): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /** 添加拦截器 */
  addInterceptor(interceptor: {
    request?: (url: string, options: RequestInit) => { url: string; options: RequestInit };
    response?: (response: Response) => Response;
  }): void {
    this.interceptors.push(interceptor);
  }
}
