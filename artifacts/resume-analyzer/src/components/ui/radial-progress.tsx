import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface RadialProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function RadialProgress({
  value,
  size = 120,
  strokeWidth = 10,
  className,
}: RadialProgressProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 300);
    return () => clearTimeout(timer);
  }, [value]);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (animatedValue / 100) * circumference;

  let colorClass = "text-indigo-500";
  if (value >= 80) colorClass = "text-emerald-500";
  else if (value <= 40) colorClass = "text-rose-500";
  else if (value <= 60) colorClass = "text-amber-500";

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg className="transform -rotate-90 w-full h-full">
        {/* Background Circle */}
        <circle
          className="text-slate-100"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress Circle */}
        <motion.circle
          className={colorClass}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold tracking-tight text-slate-900">
          {Math.round(animatedValue)}<span className="text-xl text-slate-400">%</span>
        </span>
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Match</span>
      </div>
    </div>
  );
}
