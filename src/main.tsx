import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { MidgeThemeProvider } from "./theme/MidgeThemeProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MidgeThemeProvider>
      <App />
    </MidgeThemeProvider>
  </React.StrictMode>,
);
