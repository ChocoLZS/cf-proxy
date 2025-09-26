import { getOrFetchJson } from './cache.js';

export interface Route {
  pattern: RegExp;
  handler: (request: Request, ...args: any[]) => Promise<Response>;
}

async function handleLinkuraLocalifyAssets(request: Request, env?: Env): Promise<Response> {
  if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  const gh_token = await env?.KV.get('linkura::data::gh-api-key');
  // find cache first
  const res = await getOrFetchJson<any>(
    'https://api.github.com/repos/ChocoLZS/linkura-localify-assets/releases',
    {
      headers: {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Authorization": `Bearer ${gh_token ?? ''}`
      }
    },
    5 * 60 * 1000, // 5 minutes
    data => {
      // Process the data if needed
      return data;
    },
    env
  )
  return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export const routes: Route[] = [
  { 
    pattern: /^\/api\/linkura-localify-assets$/, 
    handler: (request: Request, env?: Env) => handleLinkuraLocalifyAssets(request, env)
  },
];