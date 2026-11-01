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
  // O link do push aponta para URL_PAINEL; reescreve para a origem atual (útil em dev e no PWA).
  let url = self.location.origin + "/";
  try {
    const alvo = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
    url = self.location.origin + alvo.pathname + alvo.search + alvo.hash;
  } catch {
    // URL inválida no payload: abre a home.
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      const aba = abas.find((a) => "navigate" in a && "focus" in a);
      if (!aba) return self.clients.openWindow(url);
      return aba
        .navigate(url)
        .then((a) => (a || aba).focus())
        .catch(() => self.clients.openWindow(url));
    }),
  );
});
