import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";

const pill =
  "rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200";

export function Navbar() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-50 border-b border-line bg-void/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <NavLink to="/" className="font-display text-xl font-bold tracking-tight">
          Movie <span className="text-glow">RecSys</span>
        </NavLink>
        <nav className="flex flex-wrap items-center gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `${pill} ${isActive ? "bg-glow/15 text-glow" : "text-mist hover:bg-elevated hover:text-white"}`
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/taste"
            className={({ isActive }) =>
              `${pill} ${isActive ? "bg-glow/15 text-glow" : "text-mist hover:bg-elevated hover:text-white"}`
            }
          >
            Taste
          </NavLink>
          <NavLink
            to="/browse"
            className={({ isActive }) =>
              `${pill} ${isActive ? "bg-glow/15 text-glow" : "text-mist hover:bg-elevated hover:text-white"}`
            }
          >
            Explore
          </NavLink>
          <NavLink
            to="/saved"
            className={({ isActive }) =>
              `${pill} ${isActive ? "bg-pop/20 text-pop" : "text-mist hover:bg-elevated hover:text-white"}`
            }
          >
            Saved
          </NavLink>
        </nav>
      </div>
    </motion.header>
  );
}

