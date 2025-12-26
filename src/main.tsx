import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import LoginPage from "./pages/LoginPage";
import RewardsHubPage from "./pages/RewardsHubPage";
import RequireAuth from "./app/RequireAuth";
import AuthCallbackPage from "./pages/AuthCallbackPage";



ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
         <Route path="/register" element={<LoginPage />} />
        <Route path="/rewards" element={<RequireAuth>
                                          <RewardsHubPage /> 
                                        </RequireAuth>
                                       } 
                                     />
        <Route path="*" element={<Navigate to="/login" replace />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
