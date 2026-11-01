// Service worker do Vizualizer: recebe Web Push e abre o card do vídeo no toque.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { title: "Vizualizer", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(d.title || "Vizualizer", {
      body: d.body || "",
      icon: d.icon || "/icone-192.png",
      badge: "/icone-192.png",
      data: d.data || { url: "/" },
      tag: d.data && d.data.url,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const alvo = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
  // O link do push aponta para URL_PAINEL; reescreve para a origem atual (útil em dev e no PWA).
  const url = self.location.origin + alvo.pathname;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      for (const aba of abas) {
        if ("focus" in aba) {
          aba.navigate(url);
          return aba.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
