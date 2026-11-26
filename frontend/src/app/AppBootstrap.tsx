import { useEffect, useRef, useState } from "react";
import { AppSplash } from "../components/AppSplash";
import { useAuth } from "../modules/auth/AuthProvider";
import { AppRouter } from "./router";

const SPLASH_MIN_MS = 2000;
const SPLASH_FADE_MS = 700;
const SPLASH_MAX_MS = 8000;

export function AppBootstrap() {
  const { ready } = useAuth();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [bootTimeout, setBootTimeout] = useState(false);
  const exitStartedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinTimeElapsed(true), SPLASH_MIN_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setBootTimeout(true), SPLASH_MAX_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const bootReady = ready || bootTimeout;
    if (!minTimeElapsed || !bootReady || exitStartedRef.current) {
      return;
    }
    exitStartedRef.current = true;
    setLeaving(true);
    const timer = window.setTimeout(() => setShowApp(true), SPLASH_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [minTimeElapsed, ready, bootTimeout]);

  return (
    <>
      {!showApp ? <AppSplash leaving={leaving} /> : null}
      {showApp ? <AppRouter /> : null}
    </>
  );
}