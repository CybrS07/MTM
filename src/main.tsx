import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyTheme, initialMode } from "./theme";
import "./styles.css";

applyTheme(initialMode());
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
