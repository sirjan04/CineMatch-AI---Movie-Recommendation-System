import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Browse } from "./pages/Browse";
import { Home } from "./pages/Home";
import { MovieDetail } from "./pages/MovieDetail";
import { Saved } from "./pages/Saved";
import { Taste } from "./pages/Taste";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/taste" element={<Taste />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/movie/:id" element={<MovieDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
