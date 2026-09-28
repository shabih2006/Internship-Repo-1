// main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./src/App"; // <-- IMPORTANT: import App, not ChatUI

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
