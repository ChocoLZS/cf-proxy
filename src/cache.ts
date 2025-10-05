export interface CacheItem<T> {
  data: T;
  expiredAt: number; // 毫秒时间戳，Infinity 表示永不过期
}

export type TextProcessor = (text: string, url: string, baseUrl?: URL, params?: any) => string;

// Durable Object 缓存接口
export interface DurableCache {
  getCacheItem(key: string): Promise<CacheItem<any> | null>;
  setCacheItem(key: string, item: CacheItem<any>): Promise<void>;
  deleteCacheItem(key: string): Promise<void>;
}

// Durable Object 缓存实现
export class DurableObjectCache implements DurableCache {
  private cacheStorage: DurableObjectStub;

  constructor(cacheStorage: DurableObjectStub) {
    this.cacheStorage = cacheStorage;
  }

  async getCacheItem(key: string): Promise<CacheItem<any> | null> {
    const response = await this.cacheStorage.fetch(`https://cache/cache/${encodeURIComponent(key)}`);
    const result = await response.json() as CacheItem<any> | null;
    return result || null;
  }

  async setCacheItem(key: string, item: CacheItem<any>): Promise<void> {
    await this.cacheStorage.fetch(`https://cache/cache/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
  }

  async deleteCacheItem(key: string): Promise<void> {
    await this.cacheStorage.fetch(`https://cache/cache/${encodeURIComponent(key)}`, {
      method: 'DELETE'
    });
  }
}

// 全局缓存封装类
export class GlobalCache {
  private cache: DurableObjectCache;

  constructor(env: Env) {
    const cacheId = env.CACHE_STORAGE.idFromName("global-cache");
    const cacheStub = env.CACHE_STORAGE.get(cacheId);
    this.cache = new DurableObjectCache(cacheStub);
  }

  async get<T>(key: string): Promise<T | null> {
    const item = await this.cache.getCacheItem(key);
    return item ? item.data as T : null;
  }

  async set<T>(key: string, data: T, ttlMs: number = Infinity): Promise<void> {
    const expiredAt = ttlMs === Infinity ? Infinity : Date.now() + ttlMs;
    await this.cache.setCacheItem(key, { data, expiredAt });
  }

  async delete(key: string): Promise<void> {
    await this.cache.deleteCacheItem(key);
  }

  async has(key: string): Promise<boolean> {
    const item = await this.cache.getCacheItem(key);
    return item !== null;
  }
}

export function createCorsHeaders(): Headers {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return headers;
}

export function addCorsHeaders(response: Response): Response {
  const corsHeaders = createCorsHeaders();
  const newHeaders = new Headers(response.headers);
  
  for (const [key, value] of corsHeaders.entries()) {
    newHeaders.set(key, value);
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

export async function getOrFetchJson<T>(
  url: string,
  init?: Parameters<typeof fetch>[1],
  ttlMs: number = Infinity,
  processor?: (data: T) => T,
  env?: Env
): Promise<T> {
  const now = Date.now();
  const cacheKey = url;
  
  // 检查缓存是否有效
  let cache: DurableObjectCache | null = null;
  let cached: CacheItem<T> | null = null;
  if (env?.CACHE_STORAGE) {
    const cacheStub = env.CACHE_STORAGE.get(env.CACHE_STORAGE.idFromName("global"));
    const durableCache = new DurableObjectCache(cacheStub);

    cached = await durableCache.getCacheItem(cacheKey);
  }

  if (cached && cached.expiredAt > now) {
    return cached.data;
  }
  
  // 缓存过期或不存在，重新获取
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }
  
  const text = await response.json();
  let processedData = text;
  
  // 如果提供了处理器，处理文本内容
  if (processor) {
    console.log('Processing fetched data with processor');
    processedData = processor(text as T);
  }
  
  // 存储到缓存
  const cacheItem: CacheItem<any> = {
    data: processedData,
    expiredAt: ttlMs === Infinity ? Infinity : now + ttlMs
  };
  
  await (cache as (DurableCache | null))?.setCacheItem(cacheKey, cacheItem);
  
  return processedData as T;
}