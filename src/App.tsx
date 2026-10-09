import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { SiteLayout } from './components/layout/SiteLayout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

const Checkout = lazy(() => import('./pages/Checkout'));
const Confirmation = lazy(() => import('./pages/Confirmation'));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'));
const Privacy = lazy(() => import('./pages/Privacy'));
/** Admin is a separate chunk so customers never download it. */
const AdminApp = lazy(() => import('./admin/AdminApp'));

function PageFallback({ light }: { light?: boolean }) {
  return (
    <div
      className={
        light
          ? 'grid min-h-screen place-items-center bg-neutral-50'
          : 'grid min-h-[60vh] place-items-center'
      }
      role="status"
    >
      <span
        className={
          light
            ? 'h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900'
            : 'h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-ghana-gold'
        }
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<PageFallback light />}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route
          path="checkout"
          element={
            <Suspense fallback={<PageFallback />}>
              <Checkout />
            </Suspense>
          }
        />
        <Route
          path="order/:number"
          element={
            <Suspense fallback={<PageFallback />}>
              <Confirmation />
            </Suspense>
          }
        />
        <Route
          path="unsubscribe"
          element={
            <Suspense fallback={<PageFallback />}>
              <Unsubscribe />
            </Suspense>
          }
        />
        <Route
          path="privacy"
          element={
            <Suspense fallback={<PageFallback />}>
              <Privacy />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
