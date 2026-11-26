import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppBootstrap } from "./app/AppBootstrap";
import { AppProviders } from "./app/providers";
import "./index.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Élément racine #root introuvable.");
}

createRoot(root).render(
  <StrictMode>
      <AppProviders>
        <AppBootstrap />
      </AppProviders>
  </StrictMode>,
);