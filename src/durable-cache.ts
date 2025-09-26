import { CacheItem } from './cache.js';

export class CacheStorage {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const pathParts = url.pathname.split('/').filter(Boolean);

    try {
      switch (method) {
        case 'GET':
          if (pathParts[0] === 'cache') {
            // GET /cache/{key}
            const key = pathParts[1];
            const cacheItem = await this.state.storage.get<CacheItem<any>>(`cache:${key}`);
            
            // 检查是否过期
            if (cacheItem && cacheItem.expiredAt !== Infinity && cacheItem.expiredAt <= Date.now()) {
              await this.state.storage.delete(`cache:${key}`);
              return new Response(JSON.stringify(null), {
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            return new Response(JSON.stringify(cacheItem || null), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case 'PUT':
          if (pathParts[0] === 'cache') {
            // PUT /cache/{key}
            const key = pathParts[1];
            const cacheItem: CacheItem<any> = await request.json();
            await this.state.storage.put(`cache:${key}`, cacheItem);
            return new Response('OK');
          }
          break;

        case 'DELETE':
          if (pathParts[0] === 'cache') {
            // DELETE /cache/{key}
            const key = pathParts[1];
            await this.state.storage.delete(`cache:${key}`);
            return new Response('OK');
          }
          break;
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      return new Response(`Error: ${(error as Error).message}`, { status: 500 });
    }
  }
}