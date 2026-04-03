export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1); // Remove leading /

    if (!key) {
      return new Response('WOL Assets Server', { status: 200 });
    }

    const object = await env.ASSETS.get(key);
    if (!object) {
      return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=86400'); // Cache 24h
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(object.body, { headers });
  },
};
