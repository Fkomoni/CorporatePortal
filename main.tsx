import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import App from "./App.tsx";
import { Provider } from "./provider.tsx";
import "@/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Provider>
        <App />
        <Toaster
          toastOptions={{
            className: "text-sm",
            position: "bottom-center",
            duration: 6000,
          }}
        />
      </Provider>
    </BrowserRouter>
  </React.StrictMode>,
);
