import { motion } from "framer-motion";

type Props = {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
};

export function StarRating({ value, onChange, readOnly }: Props) {
  return (
    <div className="flex gap-0.5" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value >= n;
        return (
          <motion.button
            key={n}
            type="button"
            disabled={readOnly || !onChange}
            whileHover={onChange && !readOnly ? { scale: 1.15 } : undefined}
            whileTap={onChange && !readOnly ? { scale: 0.9 } : undefined}
            onClick={() => onChange?.(n)}
            className={`text-lg leading-none ${on ? "text-glow" : "text-elevated"} ${
              readOnly ? "cursor-default" : "cursor-pointer"
            }`}
            aria-label={`${n} stars`}
          >
            {"\u2605"}
          </motion.button>
        );
      })}
    </div>
  );
}
