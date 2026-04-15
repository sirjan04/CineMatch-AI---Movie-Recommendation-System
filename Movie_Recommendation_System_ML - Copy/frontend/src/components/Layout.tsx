import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";

export function Layout() {
  return (
    <div className="min-h-screen mesh-bg">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-8">
        <Outlet />
      </div>
    </div>
  );
}
