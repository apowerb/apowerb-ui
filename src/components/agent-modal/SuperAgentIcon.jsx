"use client";

import {
  Database,
  DatabaseZap,
  Image as ImageIcon,
  Mail,
  BarChart3,
  TrendingUp,
  BookOpen,
  Mic,
  Headphones,
} from "lucide-react";
import BrandIcon from "@/components/brand/BrandIcon";

// Map backend icon names to Lucide components
export const SUPERAGENT_ICONS = {
  Database,
  DatabaseZap,
  Image: ImageIcon,
  Mail,
  BarChart3,
  TrendingUp,
  BookOpen,
  Mic,
  Headphones,
};

export default function SuperAgentIcon({ iconName, size = 24, className = "text-blue-400" }) {
  const Icon = SUPERAGENT_ICONS[iconName];
  if (Icon) return <Icon size={size} className={className} />;
  // Fallback: app logo
  return (
    <BrandIcon
      width={size}
      height={size}
      alt="Agent"
      className="rounded-full"
    />
  );
}
