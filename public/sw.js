const VERSION = "mednexus-shell-v1"
const SHELL = ["/", "/profile", "/theory", "/icon.svg", "/apple-icon.png"]

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("mednexus-shell-") && key !== VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener("fetch", event => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin") || url.pathname.startsWith("/group-study") || url.pathname.startsWith("/exam/") || url.pathname.startsWith("/notifications")) return
  event.respondWith(
    fetch(request).then(response => {
      if (response.ok) caches.open(VERSION).then(cache => cache.put(request, response.clone()))
      return response
    }).catch(async () => (await caches.match(request)) || (request.mode === "navigate" ? caches.match("/") : undefined)),
  )
})
