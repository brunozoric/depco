import type React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

function AppRoot(): React.ReactNode {
    return <App />;
}

const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error("Root element not found");
}

createRoot(rootElement).render(<AppRoot />);
