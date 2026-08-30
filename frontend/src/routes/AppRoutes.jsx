import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "../pages/Login";
import Landing from "../pages/LandingPage";
import Dashboard from "../pages/Dashboard";
import Builder from "../pages/Builder";
import FormResponses from "../pages/FormResponses";
import PublicForm from "../pages/PublicForm";
import Success from "../pages/Success";
import NotFound from "../pages/NotFound";

import ProtectedRoute from "./ProtectedRoute";
import PublicOnlyRoute from "./PublicOnlyRoute";
import InstallPWA from "@/components/common/InstallPWA";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <InstallPWA />
      <Routes>

        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route path="/forms/:shareToken" element={<PublicForm />} />
        <Route path="/forms/single/:singleToken" element={<PublicForm />} />
        <Route path="/success" element={<Success />} />


        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/builder/:id"
          element={
            <ProtectedRoute>
              <Builder />
            </ProtectedRoute>
          }
        />

        <Route
          path="/builder/:id/responses"
          element={
            <ProtectedRoute>
              <FormResponses />
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
