self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'New message', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Client Portal';
  const options = {
    body: data.body || 'You have a new message.',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: data.tag || 'vargaflow-push',
    renotify: true,
    data: { url: data.url || '/messages' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/messages';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
