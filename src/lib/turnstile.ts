/*
 * Cloudflare Turnstile, loaded straight from Cloudflare (no npm package).
 * Used once per player: the token proves a human before Supabase creates an
 * anonymous user. The widget is invisible unless Cloudflare wants a check.
 */

type TurnstileOptions = {
  sitekey: string;
  execution: "render" | "execute";
  appearance: "always" | "execute" | "interaction-only";
  callback: (token: string) => void;
  "error-callback": () => void;
  "timeout-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  execute: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptLoading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  scriptLoading ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile not available"));
    script.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptLoading = null; // allow a retry
    throw error;
  });
  return scriptLoading;
}

/** Runs an invisible Turnstile check and resolves with its token. */
export async function getTurnstileToken(siteKey: string): Promise<string> {
  const turnstile = await loadTurnstile();

  return new Promise<string>((resolve, reject) => {
    // Shown only if Cloudflare decides it needs the player to click.
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:50";
    document.body.appendChild(container);

    let widgetId = "";
    const cleanup = () => {
      if (widgetId) turnstile.remove(widgetId);
      container.remove();
    };

    widgetId = turnstile.render(container, {
      sitekey: siteKey,
      execution: "execute",
      appearance: "interaction-only",
      callback: (token) => {
        cleanup();
        resolve(token);
      },
      "error-callback": () => {
        cleanup();
        reject(new Error("Turnstile check failed"));
      },
      "timeout-callback": () => {
        cleanup();
        reject(new Error("Turnstile check timed out"));
      },
    });
    turnstile.execute(widgetId);
  });
}
