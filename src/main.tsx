import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./pwa";
import "./styles.css";
import "./radix.css";
import "./learning.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
