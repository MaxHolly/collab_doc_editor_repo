import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import Home from "./pages/Home";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import RefreshPage from "./pages/RefreshPage";
import LogoutPage from "./pages/LogoutPage";
import SharePage from "./pages/SharePage";
import DocumentsList from "./pages/DocumentsList";
import DocumentCreate from "./pages/DocumentCreate";
import DocumentDetail from "./pages/DocumentDetail";
import DocumentEditor from "./pages/DocumentEditor";
import ProtectedRoute from "./components/ProtectedRoute";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* protected */}
        <Route
          path="/refresh"
          element={
            <ProtectedRoute>
              <RefreshPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/logout"
          element={
            <ProtectedRoute>
              <LogoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/docs"
          element={
            <ProtectedRoute>
              <DocumentsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/docs/new"
          element={
            <ProtectedRoute>
              <DocumentCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/docs/:docId"
          element={
            <ProtectedRoute>
              <DocumentDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/docs/:docId/share"
          element={
            <ProtectedRoute>
              <SharePage />
            </ProtectedRoute>
          }
        />
        {
          <Route
            path="/doc/:docId"
            element={
              <ProtectedRoute>
                <DocumentEditor />
              </ProtectedRoute>
            }
          />
        }

        {/* fallback */}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
