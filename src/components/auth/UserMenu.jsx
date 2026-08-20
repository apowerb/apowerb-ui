"use client";

import { useState, useRef, useEffect } from "react";
import { User, LogOut, Settings, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function UserMenu({ onOpenProfile, onLogout, collapsed = false }) {
  const { user, logout, isLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    onLogout?.();
  };

  const handleOpenProfile = () => {
    setIsOpen(false);
    onOpenProfile?.();
  };

  // Get initials for avatar
  const getInitials = () => {
    const first = user?.firstName?.[0] || user?.username?.[0] || "";
    const last = user?.lastName?.[0] || "";
    return (first + last).toUpperCase() || "?";
  };

  // Get display name
  const getDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.username || user?.email || "User";
  };

  if (!user) return null;

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-3 w-full p-2 rounded-xl
          hover:th-bg-surface-hover transition-all
          ${isOpen ? "th-bg-surface" : ""}
        `}
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 th-border shrink-0">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt="Avatar"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
              {getInitials()}
            </div>
          )}
        </div>

        {/* Name and email (hidden when collapsed) */}
        {!collapsed && (
          <>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium th-text truncate">
                {getDisplayName()}
              </p>
              <p className="text-xs th-text-muted truncate">{user.email}</p>
            </div>
            <ChevronDown
              size={16}
              className={`th-text-muted transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className={`
            absolute bottom-full mb-2 ${collapsed ? "left-0" : "left-0 right-0"}
            min-w-[200px] rounded-xl p-2 shadow-xl
            bg-[var(--bg-dropdown)] border border-[var(--border-primary)]
            animate-slide-up z-50
          `}
        >
          {/* User info header */}
          <div className="px-3 py-2 border-b th-border mb-2">
            <p className="text-sm font-medium th-text truncate">
              {getDisplayName()}
            </p>
            <p className="text-xs th-text-muted truncate">{user.email}</p>
          </div>

          {/* Menu items */}
          <button
            onClick={handleOpenProfile}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm th-text-secondary hover:th-bg-surface-hover rounded-lg transition-colors"
          >
            <Settings size={16} />
            My Profile
          </button>

          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Simple avatar component for use in other places
 */
export function UserAvatar({ size = "md", onClick }) {
  const { user } = useAuth();

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-lg",
  };

  const getInitials = () => {
    const first = user?.firstName?.[0] || user?.username?.[0] || "";
    const last = user?.lastName?.[0] || "";
    return (first + last).toUpperCase() || "?";
  };

  if (!user) return null;

  return (
    <button
      onClick={onClick}
      className={`
        ${sizeClasses[size]} rounded-full overflow-hidden
        border-2 th-border hover:border-blue-500/50
        transition-all cursor-pointer
      `}
    >
      {user.avatar ? (
        <img
          src={user.avatar}
          alt="Avatar"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white">
          {getInitials()}
        </div>
      )}
    </button>
  );
}
