"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";

const DISMISS_KEY = "ff-install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Shows a real install button when the browser supports install prompts.
 * On iOS it shows the manual "Add to Home Screen" instructions instead,
 * because Safari does not fire beforeinstallprompt.
 */
export function InstallApp({ className = "" }) {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(true);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setInstalled(isStandalone());
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    const onPrompt = (event) => {
      event.preventDefault();
      setPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;

  async function install() {
    if (prompt) {
      prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === "accepted") setInstalled(true);
      setPrompt(null);
      return;
    }
    setIosHint(true);
  }

  function hide() {
    setDismissed(true);
    window.localStorage.setItem(DISMISS_KEY, "1");
  }

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-1">
        <Button type="button" variant="secondary" onClick={install} className="px-3">
          Install app
        </Button>
        <button
          type="button"
          aria-label="Hide install button"
          className="grid h-11 w-8 place-items-center rounded text-navy/60 hover:bg-powder"
          onClick={hide}
        >
          ×
        </button>
      </div>
      {iosHint ? (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-soft bg-white p-3 text-left text-xs shadow-lg">
          <p className="font-semibold">Add to Home Screen</p>
          {isIos() ? (
            <p className="mt-1">
              In Safari, tap the Share button, then choose <strong>Add to Home Screen</strong>.
            </p>
          ) : (
            <p className="mt-1">
              Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. If the option
              is missing, the app is not yet installable in this browser.
            </p>
          )}
          <button type="button" className="mt-2 font-semibold text-cyan" onClick={() => setIosHint(false)}>
            Got it
          </button>
        </div>
      ) : null}
    </div>
  );
}
