import { routes } from './handlers.js';
import { CacheStorage } from './durable-cache.js';
import { createAppContext } from './context.js';

export { CacheStorage };

export default {
  async fetch(request, env, ctx) {
    const appContext = createAppContext(request, env, ctx);
    const pathname = new URL(request.url).pathname;
    
    for (const route of routes) {
      const match = pathname.match(route.pattern);
      if (match) {
        return route.handler(appContext, ...match.slice(1));
      }
    }
    
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
