import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { AddIngredient } from './pages/AddIngredient';
import { Settings } from './pages/Settings';

// Placeholder pages - will be implemented later
const IngredientDetails: React.FC = () => (
  <div className="text-center py-12">
    <h1 className="text-2xl font-bold">Détails Ingrédient</h1>
    <p className="text-stone-500 mt-2">Page en construction</p>
  </div>
);

const EditIngredient: React.FC = () => (
  <div className="text-center py-12">
    <h1 className="text-2xl font-bold">Modifier Ingrédient</h1>
    <p className="text-stone-500 mt-2">Page en construction</p>
  </div>
);

const StorageMap: React.FC = () => (
  <div className="text-center py-12">
    <h1 className="text-2xl font-bold">Carte des Rangements</h1>
    <p className="text-stone-500 mt-2">Page en construction</p>
  </div>
);

const ChefAssistant: React.FC = () => (
  <div className="text-center py-12">
    <h1 className="text-2xl font-bold">Chef IA</h1>
    <p className="text-stone-500 mt-2">Page en construction</p>
  </div>
);

const Analytics: React.FC = () => (
  <div className="text-center py-12">
    <h1 className="text-2xl font-bold">Statistiques</h1>
    <p className="text-stone-500 mt-2">Page en construction</p>
  </div>
);

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-kitchen-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// App Routes
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/add-ingredient" element={<AddIngredient />} />
        <Route path="/ingredient/:id" element={<IngredientDetails />} />
        <Route path="/ingredient/:id/edit" element={<EditIngredient />} />
        <Route path="/storage" element={<StorageMap />} />
        <Route path="/chef" element={<ChefAssistant />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// Main App
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
