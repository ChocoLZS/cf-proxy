import { GlobalCache } from './cache.js';

export interface Route {
  pattern: RegExp;
  handler: (ctx: AppContext, ...args: any[]) => Promise<Response>;
}

// 应用上下文接口
export interface AppContext {
  env: Env;
  cache: GlobalCache;
  executionContext: ExecutionContext;
  requestId: string;
  request: Request;
}

// 创建应用上下文
export function createAppContext(request: Request, env: Env, executionContext: ExecutionContext): AppContext {
  const cache = new GlobalCache(env);
  const requestId = crypto.randomUUID();
  
  return {
    env,
    cache,
    executionContext,
    requestId,
    request
  };
}