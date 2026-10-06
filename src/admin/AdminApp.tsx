import { lazy, Suspense, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useMe } from './api';
import { AdminLayout } from './AdminLayout';
import { ErrorState, Spinner } from './ui';
import Login from './pages/Login';

const Orders = lazy(() => import('./pages/Orders'));
const Prep = lazy(() => import('./pages/Prep'));

function FullScreenSpinner() {
  return (
    <div className="admin grid min-h-screen place-items-center bg-neutral-50">
      <Spinner />
    </div>
  );
}

function RequireAdmin({ children }: { children: (email: string) => ReactNode }) {
  const { data: me, isLoading, isError, refetch } = useMe();
  const location = useLocation();
  if (isLoading) return <FullScreenSpinner />;
  if (isError)
    return (
      <div className="admin grid min-h-screen place-items-center bg-neutral-50 p-6">
        <ErrorState message="Can’t reach the server." onRetry={refetch} />
      </div>
    );
  if (!me) return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children(me.email)}</>;
}

function AdminNotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-lg font-semibold">Page not found</p>
      <Link to="/admin" className="mt-2 inline-block text-sm text-ghana-green underline">
        Back to dashboard
      </Link>
    </div>
  );
}

const page = (el: ReactNode) => (
  <Suspense
    fallback={
      <div className="grid place-items-center py-20">
        <Spinner />
      </div>
    }
  >
    {el}
  </Suspense>
);

export default function AdminApp() {
  const { data: me, isLoading } = useMe();
  return (
    <Routes>
      <Route path="login" element={isLoading ? <FullScreenSpinner /> : me ? <Navigate to="/admin" replace /> : <Login />} />
      <Route element={<RequireAdmin>{(email) => <AdminLayout email={email} />}</RequireAdmin>}>
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="orders" element={page(<Orders />)} />
        <Route path="prep" element={page(<Prep />)} />
        <Route path="*" element={<AdminNotFound />} />
      </Route>
    </Routes>
  );
}
