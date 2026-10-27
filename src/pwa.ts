import { registerSW } from "virtual:pwa-register";

// registerSW hands back the callback that sends SKIP_WAITING to the waiting
// worker; the plugin then reloads the page once the new worker takes control.
// keeps re-serving the old version forever in prompt mode.
const updateServiceWorker = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new Event("kachi-update-ready"));
  },
});

export function activateUpdate(): void {
  void updateServiceWorker();
}
