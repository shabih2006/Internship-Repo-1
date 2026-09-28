// src/App.tsx
import React from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import LoginPage from "./LoginPage";
import ChatUI from "./ChatUI";
import ComparisonPage from "./components/ComparisonPage";

const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();

  // Public: comparison page works without login (deep link feature)
  const params = new URLSearchParams(window.location.search);
  const comparisonId = params.get("comparison");
  if (comparisonId) {
    const id = Number(comparisonId);
    if (!Number.isNaN(id) && id > 0) {
      return <ComparisonPage documentId={id} />;
    }
  }

  // Gate: everything else requires auth
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <ChatUI />;
};

const App: React.FC = () => (
  <AuthProvider>
    <AppRoutes />
  </AuthProvider>
);

export default App;
