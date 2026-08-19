"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "@/lib/navigation";
import { Image } from "@/lib/navigation";
import { Link } from "@/lib/navigation";
import BrandIcon from "@/components/brand/BrandIcon";
import {
  ShieldCheck,
  Home,
  MessageSquare,
  Users,
  Wrench,
  Calendar,
  Store,
  ChevronLeft,
  ChevronRight,
  Menu,
  PlugZap,
  Webhook,
  BarChart3,
  Activity,
  Rocket,
  Gauge,
  ScrollText,
  FileCode,
} from "lucide-react";
import { useTranslations } from "use-intl";
import { ToastProvider } from "./Toast";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { UserProfileModal, UserMenu } from "./auth";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import NotificationBell from "./NotificationBell";
import Slot from "@/extensions/Slot";
import { navItemsFor } from "@/extensions/registry";

const BRAND_GRADIENT = "from-brand to-brand-secondary";

// Standalone item, always pinned at the top (no category header).
// labelKey/titleKey → clés du namespace "Nav" (messages/{locale}.json).
const HOME_ITEM = {
  path: "/",
  labelKey: "home",
  icon: Home,
  color: BRAND_GRADIENT,
  exact: true,
};

// Navigation grouped by category. Order = display order.
const NAV_GROUPS = [
  {
    titleKey: "groupBuild",
    items: [
      { path: "/chat", labelKey: "chat", icon: MessageSquare, color: BRAND_GRADIENT },
      { path: "/agents", labelKey: "agents", icon: Users, color: BRAND_GRADIENT },
      { path: "/artifacts", labelKey: "artifacts", icon: FileCode, color: BRAND_GRADIENT },
      { path: "/bi", labelKey: "bi", icon: BarChart3, color: BRAND_GRADIENT },
    ],
  },
  {
    titleKey: "groupTools",
    items: [
      { path: "/tool-box", labelKey: "toolBox", icon: Wrench, color: BRAND_GRADIENT },
      { path: "/integrations", labelKey: "integrations", icon: PlugZap, color: BRAND_GRADIENT },
    ],
  },
  {
    titleKey: "groupAutomate",
    items: [
      { path: "/webhooks", labelKey: "webhooks", icon: Webhook, color: BRAND_GRADIENT },
      { path: "/orchestrator", labelKey: "orchestrator", icon: Calendar, color: BRAND_GRADIENT },
    ],
  },
  {
    titleKey: "groupAgentOps",
    // `/usage` et `/supervision` ne sont PAS ici : leurs pages n'existent que
    // dans les briques commerciales. Écrites en dur, elles donnaient un menu
    // qui promet ce que l'édition open source ne contient pas — `/usage`
    // rendait 404 sur une vraie installation. Les briques les déposent
    // elles-mêmes via `registerNavItem("groupAgentOps", …)`.
    items: [
      { path: "/logging", labelKey: "logging", icon: ScrollText, color: BRAND_GRADIENT },
    ],
  },
  {
    // Le panneau de contrôle est du noyau depuis le 18/08/2026. Le menu peut
    // donc le nommer : la règle n'a jamais été « pas de rubrique Admin », mais
    // « ne nomme que ce que tu contiens ».
    titleKey: "groupAdmin",
    items: [
      { path: "/admin", labelKey: "admin", icon: ShieldCheck, color: BRAND_GRADIENT },
    ],
  },
  {
    titleKey: "groupDiscover",
    items: [
      { path: "/marketplace", labelKey: "marketplace", icon: Store, color: BRAND_GRADIENT },
    ],
  },
];

// Plus de groupe « Admin » dans le noyau : il ne contenait que Supervision,
// qui relève d'une brique, et une section d'administration sans administration
// n'a rien à annoncer. Une brique qui apporte de l'administration déclare son
// propre groupe avec `registerNavItem`.

function AppContent({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const t = useTranslations("Nav");

  // Chaque groupe = ce que le noyau contient + ce que les briques y ont déposé.
  // Sans brique, `navItemsFor` rend `[]` et le menu est exactement le produit
  // open source. Un groupe qui reste vide n'est pas affiché du tout : mieux
  // vaut pas de rubrique qu'une rubrique qui ne mène nulle part.
  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: [...group.items, ...navItemsFor(group.titleKey)],
  })).filter((group) => group.items.length > 0);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });
  const [showProfile, setShowProfile] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", isCollapsed);
  }, [isCollapsed]);

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const label = t(item.labelKey);
    const isActive = item.exact
      ? pathname === item.path
      : pathname === item.path || pathname.startsWith(item.path + "/");

    return (
      <Link
        key={item.path}
        href={item.path}
        onClick={() => setIsMobileMenuOpen(false)}
        title={isCollapsed ? label : ""}
        className={`
          group relative overflow-hidden rounded-xl transition-all duration-300
          ${isActive ? "scale-105" : "scale-100 hover:scale-102"}
          ${isCollapsed ? "md:aspect-square md:flex md:items-center md:justify-center md:p-0" : ""}
        `}
      >
        {isActive && (
          <div className={`absolute -inset-1 bg-linear-to-r ${item.color} blur-lg opacity-50 animate-pulse`} />
        )}
        <div
          className={`
            relative flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-300 w-full h-full
            ${isActive
              ? `bg-linear-to-r ${item.color} border-white/20 shadow-lg`
              : "th-bg-surface th-border hover:th-bg-surface-hover hover:th-border-hover"
            }
            backdrop-blur-xl
            ${isCollapsed ? "md:justify-center md:px-0" : ""}
          `}
        >
          <Icon
            size={20}
            className={`transition-all duration-300 shrink-0 ${isActive ? "text-white scale-110" : "th-text-faint group-hover:th-text group-hover:scale-110"}`}
          />
          <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? "md:w-0 md:opacity-0" : "w-auto opacity-100"}`}>
            <span className={`text-sm font-semibold whitespace-nowrap ${isActive ? "text-white" : "th-text-faint group-hover:th-text"}`}>
              {label}
            </span>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <>
      <div className="flex h-screen th-bg-body overflow-hidden">
        {/* Mobile Header Bar */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-14 th-bg-body th-border border-b flex items-center px-4 z-[25]">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 th-text rounded-lg hover:th-bg-surface"
            aria-label={t("openMenu")}
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="ml-3 font-semibold th-text text-sm">{t("studioTitle")}</span>
        </div>

        {/* Mobile Overlay Backdrop */}
        {isMobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 th-bg-overlay z-[30]"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            flex flex-col gap-2 p-3 border-r th-border-secondary th-bg-sidebar backdrop-blur-xl
            transition-all duration-300 ease-in-out
            fixed inset-y-0 left-0 z-[35] w-64 transform
            ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
            md:relative md:translate-x-0 md:z-20
            ${isCollapsed ? "md:w-20" : "md:w-64"}
          `}
        >
          {/* Toggle Button (desktop only) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex absolute -right-3 top-6 th-bg-elevated border th-border th-text-secondary hover:th-text p-1 rounded-full shadow-lg transition-transform hover:scale-110 z-30"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Logo / Header Area */}
          <Link
            href="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex flex-col items-start gap-1.5 mb-4 px-2 transition-all duration-300 cursor-pointer hover:opacity-80 ${isCollapsed ? "md:items-center" : ""}`}
          >
            {/* Sidebar repliée (desktop) : icône carrée adaptative */}
            <div className={`relative shrink-0 w-10 h-10 ${isCollapsed ? "hidden md:block" : "hidden"}`}>
              <BrandIcon fill className="object-contain" priority alt="apowerb" />
            </div>
            {/* Déployée, thème sombre : wordmark blanc */}
            <Image
              src="/thaink2_logo_wordmark_white.png"
              alt="thaink2"
              width={132}
              height={31}
              priority
              className={`brand-dark-only shrink-0 object-contain ${isCollapsed ? "md:hidden" : ""}`}
            />
            {/* Déployée, thème clair : icône bleue d'origine */}
            <div className={`brand-light-only relative shrink-0 w-10 h-10 ${isCollapsed ? "md:hidden" : ""}`}>
              <Image
                src="/thaink2_logo_circle.png"
                alt=""
                aria-hidden="true"
                fill
                className="object-contain"
                priority
              />
            </div>
            <h1 className={`brand-title text-sm font-bold tracking-wide ${isCollapsed ? "md:hidden" : ""}`}>
              {t("studioTitle")}
            </h1>
          </Link>

          {/* Navigation — Home pinned, then grouped by category */}
          <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pt-1.5 -mr-1 pr-1">
            {renderNavItem(HOME_ITEM)}

            {navGroups.map((group) => (
              <div key={group.titleKey} className="flex flex-col gap-2">
                {/* Category header — text when expanded, divider when collapsed */}
                <div
                  className={`px-3 pt-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wider th-text-ghost select-none ${isCollapsed ? "md:hidden" : ""}`}
                >
                  {t(group.titleKey)}
                </div>
                <div
                  className={`mx-auto my-1 h-px w-8 th-bg-surface ${isCollapsed ? "hidden md:block" : "hidden"}`}
                  aria-hidden="true"
                />
                {group.items.map(renderNavItem)}
              </div>
            ))}
          </nav>

          {/* Theme toggle + Notifications + Landing + User section at bottom */}
          <div className="pt-3 border-t flex flex-col gap-2" style={{ borderColor: "var(--border-primary)" }}>
            {/* Emplacement de pied de barre latérale. La brique commerciale y
                pose la jauge de crédit ; sans brique, rien ne s'affiche et
                c'est l'interface open source complète. */}
            <Slot name="sidebar.footer" collapsed={isCollapsed} />
            {/* Repliée, la sidebar est trop étroite pour aligner le toggle
                (48px) + 3 icônes sur une ligne : ça débordait et rognait le
                toggle. On laisse la rangée passer à la ligne et se centrer. */}
            <div className={`flex items-center gap-1 px-2 ${isCollapsed ? "flex-wrap justify-center" : "justify-between"}`}>
              {/* Barre d'icônes : plus aucun libellé, donc plus rien à
                  masquer quand la sidebar se replie — `collapsed` n'a plus
                  d'objet sur ces deux-là. */}
              <ThemeToggle />
              <LanguageToggle />
              <a
                href="/home"
                target="_blank"
                rel="noopener noreferrer"
                title={t("openLanding")}
                aria-label={t("openLanding")}
                className="w-9 h-9 flex items-center justify-center rounded-lg th-text-faint hover:th-text hover:th-bg-surface-hover transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Rocket size={18} />
              </a>
              <NotificationBell collapsed={isCollapsed} />
            </div>
            <UserMenu
              collapsed={isCollapsed}
              onOpenProfile={() => setShowProfile(true)}
            />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden relative pt-14 md:pt-0">
          {children}
        </main>
      </div>

      {showProfile && <UserProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );
}

function MainContent({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen th-bg-body flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  return <AppContent>{children}</AppContent>;
}

export default function MainLayout({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {/* ChatProvider monté ici (sous AuthProvider, qu'il consomme via
            useAuth) et au niveau du layout : il persiste entre les navigations
            du dashboard, donc l'état du chat + le flux SSE survivent quand on
            quitte le chat pour une autre fonctionnalité. */}
        <ChatProvider>
          <MainContent>{children}</MainContent>
        </ChatProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
