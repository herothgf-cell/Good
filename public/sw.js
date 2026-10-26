/* App shell only. Never cache authentication, API responses, or family records. */
const CACHE = 'praise-star-shell-v0.2.0';
const ASSETS = ['./','./index.html','./styles.css','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest','./src/main.js','./src/ui.js','./src/backend.js','./src/auth.js','./src/export.js','./supabase/functions/_shared/domain.js','./supabase/functions/_shared/service.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('praise-star-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  // Configuration is never persisted in the worker cache, and remote API calls bypass it.
  if(url.pathname.endsWith('/config.js'))return;
  const scopePath=new URL(self.registration.scope).pathname;
  const relative='./'+url.pathname.slice(scopePath.length);
  if(!ASSETS.includes(relative))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||Response.error())));
});
