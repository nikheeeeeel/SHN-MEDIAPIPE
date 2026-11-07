import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ReminderPage } from "./pages/ReminderPage";
import "./index.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <ReminderPage />
  </StrictMode>,
);
