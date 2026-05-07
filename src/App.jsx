import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { useCacheStore } from './store/cacheStore';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/auth/Login';
import { Dashboard } from './pages/dashboard/Dashboard';
import { POS, Stock, Purchases, Customers, Suppliers, Cash, Reports, Settings } from './pages';
import { ProductDetailPage } from './pages/stock/ProductDetailPage';
import { CustomerDetailPage } from './pages/cari/CustomerDetailPage';
import { SupplierDetailPage } from './pages/cari/SupplierDetailPage';
import { NewPurchasePage } from './pages/purchases/NewPurchasePage';
import { PurchaseDetailPage } from './pages/purchases/PurchaseDetailPage';
import { SaleDetailPage } from './pages/sales/SaleDetailPage';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const { initAuth } = useAuthStore();
  const clearCache = useCacheStore(s => s.clearAll);

  // Start Supabase Realtime — single WebSocket for all table changes
  useRealtimeSync();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Clear in-memory cache when user logs out
  useEffect(() => {
    const unsub = useAuthStore.subscribe(
      (state) => state.isAuthenticated,
      (isAuth) => { if (!isAuth) clearCache(); }
    );
    return unsub;
  }, [clearCache]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="pos" element={<POS />} />
        <Route path="stock" element={<Stock />} />
        <Route path="stock/product/:id" element={<ProductDetailPage />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="purchases/new" element={<NewPurchasePage />} />
        <Route path="purchases/:id" element={<PurchaseDetailPage />} />
        <Route path="sales/:id" element={<SaleDetailPage />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="cash" element={<Cash />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
