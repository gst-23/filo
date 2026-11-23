/* Filo v8 · safe, versioned app-shell cache for fast repeat launches. */
const APP_CACHE='filo-app-shell-v8';
const VENDOR_CACHE='filo-vendor-v8';
const SHELL=['./','./index.html','./app-v8.js','./styles-v8.css','./manifest-v8.webmanifest','./favicon-v8.svg','./apple-touch-icon-v8.png','./apple-touch-icon.png','./icon-192-v8.png','./icon-512-v8.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(APP_CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('filo-')&&!([APP_CACHE,VENDOR_CACHE].includes(k))).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  // Always fetch config.js and all data APIs from the network; never cache secrets or task responses.
  if(url.pathname.endsWith('/config.js') || url.hostname.endsWith('.supabase.co'))return;
  if(request.mode==='navigate' && url.origin===self.location.origin){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(APP_CACHE).then(c=>c.put('./index.html',copy)));}
      return response;
    }).catch(async()=>(await caches.match('./index.html'))||Response.error()));
    return;
  }
  if(url.origin===self.location.origin){
    event.respondWith(caches.match(request).then(hit=>hit || fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(APP_CACHE).then(c=>c.put(request,copy)));}
      return response;
    })));
    return;
  }
  // Cache only the public, immutable versioned Supabase JS library for repeat launches.
  if((url.hostname==='cdn.jsdelivr.net' && url.pathname.includes('/@supabase/supabase-js@2/')) ||
     (url.hostname==='esm.sh' && url.pathname.includes('/@supabase/supabase-js@2'))){
    event.respondWith(caches.open(VENDOR_CACHE).then(async cache=>{
      const hit=await cache.match(request);
      if(hit)return hit;
      const response=await fetch(request);
      if(response.ok && (response.type==='cors'||response.type==='basic'))event.waitUntil(cache.put(request,response.clone()));
      return response;
    }));
  }
});
