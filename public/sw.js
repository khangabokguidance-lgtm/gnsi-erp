self.addEventListener('push', function(e) {
  var data = e.data ? e.data.json() : {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'GNSI Portal', {
      body: data.body || '',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: data.url || '/' }
    })
  )
})

self.addEventListener('notificationclick', function(e) {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data.url))
})

self.addEventListener('install', function(e) { self.skipWaiting() })
self.addEventListener('activate', function(e) { e.waitUntil(clients.claim()) })