import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-slate-50">
      <Outlet />
    </div>
  );
}