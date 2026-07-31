"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "use-intl";
import BrandIcon from "@/components/brand/BrandIcon";
import { ArrowLeft, Shield, FileText, ChevronDown, ExternalLink } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   LEGAL PAGE — Privacy Policy + Terms of Service
   ═══════════════════════════════════════════════════════════ */

function Navbar() {
  const t = useTranslations("Legal");
  return (
    <header className="sticky top-0 z-50 border-b th-border th-bg-body/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/home" className="flex items-center gap-2.5">
          <div className="relative w-7 h-7">
            <BrandIcon alt="thaink2" fill className="object-contain" />
          </div>
          <span className="text-sm font-semibold th-text-secondary">TH2 Agent Studio</span>
        </Link>
        <Link
          href="/home"
          className="inline-flex items-center gap-2 text-sm th-text-muted hover:th-text-secondary transition-colors"
        >
          <ArrowLeft size={14} />
          {t("navBackToHome")}
        </Link>
      </div>
    </header>
  );
}

/* ─── TOC Accordion Item ─── */
function TocItem({ id, number, title }) {
  return (
    <a
      href={`#${id}`}
      className="text-sm th-text-muted hover:text-[#6ee7b7] transition-colors duration-200"
      onClick={(e) => {
        e.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      <span className="th-text-ghost font-mono text-xs mr-2">{number}</span>
      {title}
    </a>
  );
}

/* ─── Section Component ─── */
function Section({ id, number, title, children }) {
  return (
    <div id={id} className="scroll-mt-24 mb-12">
      <h2 className="flex items-center gap-3 mb-5">
        <span className="font-mono text-xs th-text-ghost">{number} —</span>
        <span className="font-mono text-xs font-bold text-[#6ee7b7] uppercase tracking-[0.13em]">
          {title}
        </span>
        <span className="flex-1 h-px th-border" />
      </h2>
      <div className="space-y-3 text-sm th-text-muted leading-relaxed font-light">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PRIVACY POLICY CONTENT
   ═══════════════════════════════════════════════════════════ */
function PrivacyPolicyContent() {
  const t = useTranslations("Legal");

  const tocItems = [
    { id: "pp1", number: "01", title: t("pp1Title") },
    { id: "pp2", number: "02", title: t("pp2Title") },
    { id: "pp3", number: "03", title: t("pp3Title") },
    { id: "pp4", number: "04", title: t("pp4Title") },
    { id: "pp5", number: "05", title: t("pp5Title") },
  ];

  return (
    <>
      {/* Hero */}
      <div className="mb-12">
        <div className="flex items-center gap-2.5 mb-5">
          <span className="w-6 h-px bg-[#6ee7b7]" />
          <span className="font-mono text-[11px] text-[#6ee7b7] uppercase tracking-[0.15em]">
            {t("legalDocumentationBadge")}
          </span>
        </div>
        <h1 className="font-mono text-3xl sm:text-4xl font-bold th-text mb-5">
          {t("privacyTitlePrefix")} <span className="text-[#6ee7b7]">{t("privacyTitleHighlight")}</span>
        </h1>
        <p className="text-sm th-text-muted font-light max-w-xl">
          {t("privacyIntro")}
        </p>
        <div className="flex flex-wrap gap-5 mt-5 font-mono text-xs th-text-ghost">
          <span className="flex items-center gap-1.5">
            <span className="text-[#38bdf8]">&rsaquo;</span> {t("gdprCompliantBadge")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#38bdf8]">&rsaquo;</span> {t("jurisdictionFranceBadge")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#38bdf8]">&rsaquo;</span> {t("controllerBadge")}
          </span>
        </div>
      </div>

      {/* TOC */}
      <div className="rounded-xl border th-border th-bg-surface p-5 mb-12">
        <div className="font-mono text-[11px] text-[#6ee7b7] uppercase tracking-[0.14em] mb-4">
          {t("tableOfContentsHeading")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {tocItems.map((item) => (
            <TocItem key={item.id} {...item} />
          ))}
        </div>
      </div>

      {/* Sections */}
      <Section id="pp1" number="01" title={t("pp1Title")}>
        <p>
          <strong className="th-text-secondary font-medium">{t("pp1Strong1")}</strong>
        </p>
        <p>{t("pp1Para1")}</p>
        <ul className="list-disc pl-5 space-y-1.5 th-text-muted">
          <li>{t("pp1List1_1")}</li>
          <li>{t("pp1List1_2")}</li>
          <li>{t("pp1List1_3")}</li>
          <li>{t("pp1List1_4")}</li>
          <li>{t("pp1List1_5")}</li>
          <li>{t("pp1List1_6")}</li>
        </ul>
        <p className="mt-3">
          <strong className="th-text-secondary font-medium">{t("pp1Strong2")}</strong>
        </p>
        <p>{t("pp1Para2")}</p>
        <ul className="list-disc pl-5 space-y-1.5 th-text-muted">
          <li>{t("pp1List2_1")}</li>
          <li>{t("pp1List2_2")}</li>
          <li>{t("pp1List2_3")}</li>
          <li>{t("pp1List2_4")}</li>
          <li>{t("pp1List2_5")}</li>
          <li>{t("pp1List2_6")}</li>
        </ul>
      </Section>

      <Section id="pp2" number="02" title={t("pp2Title")}>
        <p>
          {t("pp2Para1")}
        </p>
      </Section>

      <Section id="pp3" number="03" title={t("pp3Title")}>
        <p>
          <strong className="th-text-secondary font-medium">{t("pp3Strong1")}</strong>
        </p>
        <p>{t("pp3Para1")}</p>
        <p>{t("pp3Para2")}</p>

        <p className="mt-3">
          <strong className="th-text-secondary font-medium">{t("pp3Strong2")}</strong>
        </p>
        <p>{t("pp3Para3")}</p>
        <p>{t("pp3Para4")}</p>
        <p>
          {t("pp3Para5")}
        </p>

        <p className="mt-3">
          <strong className="th-text-secondary font-medium">{t("pp3Strong3")}</strong>
        </p>
        <p>{t("pp3Para6")}</p>
      </Section>

      <Section id="pp4" number="04" title={t("pp4Title")}>
        <p>
          <strong className="th-text-secondary font-medium">{t("pp4Strong1")}</strong>
        </p>
        <p>
          {t("pp4ControllerInfo")}
        </p>
        <div className="rounded-lg border th-border th-bg-surface p-4 mt-2 flex flex-wrap gap-8">
          <div>
            <div className="font-mono text-[10px] th-text-ghost uppercase tracking-wider mb-1">{t("pp4AddressLabel")}</div>
            <div className="text-sm text-[#38bdf8]">26 Avenue Foch, 57000 Metz</div>
          </div>
          <div>
            <div className="font-mono text-[10px] th-text-ghost uppercase tracking-wider mb-1">{t("pp4EmailLabel")}</div>
            <a href="mailto:contact@thaink2.com" className="text-sm text-[#38bdf8] hover:underline">contact@thaink2.com</a>
          </div>
        </div>

        <p className="mt-4">
          <strong className="th-text-secondary font-medium">{t("pp4Strong2")}</strong>
        </p>
        <p>
          Anis MEZIANI, 26 Avenue Foch, 57000 Metz —{" "}
          <a href="mailto:contact@thaink2.com" className="text-[#38bdf8] hover:underline">contact@thaink2.com</a>
        </p>
        <p>{t("pp4Para1")}</p>
      </Section>

      <Section id="pp5" number="05" title={t("pp5Title")}>
        <p>{t("pp5Para1")}</p>
        <ul className="list-disc pl-5 space-y-1.5 th-text-muted">
          <li>{t("pp5List1_1")}</li>
          <li>{t("pp5List1_2")}</li>
          <li>{t("pp5List1_3")}</li>
          <li>{t("pp5List1_4")}</li>
          <li>{t("pp5List1_5")}</li>
          <li>{t("pp5List1_6")}</li>
        </ul>
        <p className="mt-3">
          <strong className="th-text-secondary font-medium">{t("pp5Strong1")}</strong>
        </p>
        <p>
          {t("pp5SubmitRequestsTo")}{" "}
          <a href="mailto:contact@thaink2.com" className="text-[#38bdf8] hover:underline">contact@thaink2.com</a>
        </p>
        <p>{t("pp5Para3")}</p>
        <p>
          {t("pp5MoreInfo")}{" "}
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-[#38bdf8] hover:underline">
            cnil.fr
          </a>
        </p>
      </Section>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   TERMS OF SERVICE CONTENT
   ═══════════════════════════════════════════════════════════ */
function TermsOfServiceContent() {
  const t = useTranslations("Legal");

  const tocItems = [
    { id: "ts1", number: "01", title: t("ts1Title") },
    { id: "ts2", number: "02", title: t("ts2Title") },
    { id: "ts3", number: "03", title: t("ts3Title") },
    { id: "ts4", number: "04", title: t("ts4Title") },
    { id: "ts5", number: "05", title: t("ts5Title") },
    { id: "ts6", number: "06", title: t("ts6Title") },
    { id: "ts7", number: "07", title: t("ts7Title") },
    { id: "ts8", number: "08", title: t("ts8Title") },
    { id: "ts9", number: "09", title: t("ts9Title") },
    { id: "ts10", number: "10", title: t("ts10Title") },
    { id: "ts11", number: "11", title: t("ts11Title") },
    { id: "ts12", number: "12", title: t("ts12TocTitle") },
    { id: "ts13", number: "13", title: t("ts13Title") },
  ];

  return (
    <>
      {/* Hero */}
      <div className="mb-12">
        <div className="flex items-center gap-2.5 mb-5">
          <span className="w-6 h-px bg-[#6ee7b7]" />
          <span className="font-mono text-[11px] text-[#6ee7b7] uppercase tracking-[0.15em]">
            {t("legalDocumentationBadge")}
          </span>
        </div>
        <h1 className="font-mono text-3xl sm:text-4xl font-bold th-text mb-5">
          {t("termsTitlePrefix")} <span className="text-[#6ee7b7]">{t("termsTitleHighlight")}</span>
        </h1>
        <p className="text-sm th-text-muted font-light max-w-xl">
          {t("termsIntroPrefix")} <strong className="th-text-secondary font-medium">TH2 Agent Studio</strong> —
          {" "}{t("termsIntroSuffix")}
        </p>
        <div className="flex flex-wrap gap-5 mt-5 font-mono text-xs th-text-ghost">
          <span className="flex items-center gap-1.5">
            <span className="text-[#38bdf8]">&rsaquo;</span> {t("termsVersionBadge")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#38bdf8]">&rsaquo;</span> {t("termsEffectiveBadge")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[#38bdf8]">&rsaquo;</span> {t("jurisdictionFranceBadge")}
          </span>
        </div>
      </div>

      {/* Notice */}
      <div className="rounded-xl border border-[#38bdf8]/20 bg-[#38bdf8]/4 p-4 mb-12 text-sm th-text-muted">
        <strong className="text-[#38bdf8] font-mono text-xs">{t("noticeLabel")}</strong>
        {t("noticeBody")}
      </div>

      {/* TOC */}
      <div className="rounded-xl border th-border th-bg-surface p-5 mb-12">
        <div className="font-mono text-[11px] text-[#6ee7b7] uppercase tracking-[0.14em] mb-4">
          {t("tableOfContentsHeading")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {tocItems.map((item) => (
            <TocItem key={item.id} {...item} />
          ))}
        </div>
      </div>

      {/* Sections */}
      <Section id="ts1" number="01" title={t("ts1Title")}>
        <p>
          {t("ts1Para1Prefix")}{" "}
          <strong className="th-text-secondary font-medium">TH2 Agent Studio</strong>{" "}
          {t("ts1Para1Suffix")}
        </p>
        <p>
          {t("ts1Para2")}
        </p>
        <p>
          {t("ts1Para3")}
        </p>
      </Section>

      <Section id="ts2" number="02" title={t("ts2Title")}>
        <p>
          {t("ts2Para1")}
        </p>
        <p>
          {t("ts2Para2")}
        </p>
      </Section>

      <Section id="ts3" number="03" title={t("ts3Title")}>
        <p>
          {t("ts3Para1")}
        </p>
        <ul className="list-disc pl-5 space-y-1.5 th-text-muted">
          <li>{t("ts3List1")}</li>
          <li>{t("ts3List2")}</li>
          <li>{t("ts3List3")}</li>
        </ul>
        <p>
          {t("ts3Para2")}
        </p>
      </Section>

      <Section id="ts4" number="04" title={t("ts4Title")}>
        <p>
          {t("ts4Para1")}
        </p>
        <ul className="list-disc pl-5 space-y-1.5 th-text-muted">
          <li>
            <strong className="th-text-secondary font-medium">{t("ts4Item1Label")}</strong> — {t("ts4Item1Desc")}
          </li>
          <li>
            <strong className="th-text-secondary font-medium">{t("ts4Item2Label")}</strong> — {t("ts4Item2Desc")}
          </li>
          <li>
            <strong className="th-text-secondary font-medium">{t("ts4Item3Label")}</strong> — {t("ts4Item3Desc")}
          </li>
          <li>
            <strong className="th-text-secondary font-medium">{t("ts4Item4Label")}</strong> — {t("ts4Item4Desc")}
          </li>
          <li>
            <strong className="th-text-secondary font-medium">{t("ts4Item5Label")}</strong> — {t("ts4Item5Desc")}
          </li>
        </ul>
        <p>
          {t("ts4Para2")}
        </p>
      </Section>

      <Section id="ts5" number="05" title={t("ts5Title")}>
        <p>
          {t("ts5Para1")}
        </p>
        <ul className="list-disc pl-5 space-y-1.5 th-text-muted">
          <li>{t("ts5List1")}</li>
          <li>{t("ts5List2")}</li>
          <li>{t("ts5List3")}</li>
          <li>{t("ts5List4")}</li>
          <li>{t("ts5List5")}</li>
          <li>{t("ts5List6")}</li>
        </ul>
      </Section>

      <Section id="ts6" number="06" title={t("ts6Title")}>
        <p>
          {t("ts6Para1")}
        </p>
        <p>
          {t("ts6Para2")}
        </p>
      </Section>

      <Section id="ts7" number="07" title={t("ts7Title")}>
        <p>
          {t("ts7Para1")}
        </p>
        <p>
          {t("ts7Para2")}
        </p>
        <p>
          {t("ts7Para3")}
        </p>
      </Section>

      <Section id="ts8" number="08" title={t("ts8Title")}>
        <p>
          {t("ts8Para1")}
        </p>
        <p>
          {t("ts8Para2Prefix")}{" "}
          <a href="mailto:contact@thaink2.com" className="text-[#38bdf8] hover:underline">
            contact@thaink2.com
          </a>.
        </p>
      </Section>

      <Section id="ts9" number="09" title={t("ts9Title")}>
        <p>
          {t("ts9Para1Prefix")} <strong className="th-text-secondary font-medium">{t("ts9AsIs")}</strong> {t("ts9And")}{" "}
          <strong className="th-text-secondary font-medium">{t("ts9AsAvailable")}</strong> {t("ts9Para1Suffix")}
        </p>
        <p>
          {t("ts9Para2")}
        </p>
        <p>
          {t("ts9Para3")}
        </p>
      </Section>

      <Section id="ts10" number="10" title={t("ts10Title")}>
        <p>
          {t("ts10Para1")}
        </p>
        <p>
          {t("ts10Para2")}
        </p>
      </Section>

      <Section id="ts11" number="11" title={t("ts11Title")}>
        <p>
          {t("ts11Para1")}
        </p>
        <ul className="list-disc pl-5 space-y-1.5 th-text-muted">
          <li>{t("ts11List1")}</li>
          <li>{t("ts11List2")}</li>
          <li>{t("ts11List3")}</li>
          <li>{t("ts11List4")}</li>
        </ul>
        <p>
          {t("ts11Para2")}
        </p>
      </Section>

      <Section id="ts12" number="12" title={t("ts12SectionTitle")}>
        <p>
          {t("ts12Para1")}
        </p>
      </Section>

      <Section id="ts13" number="13" title={t("ts13Title")}>
        <p>{t("ts13Para1")}</p>
        <div className="rounded-lg border th-border th-bg-surface p-4 mt-2 flex flex-wrap gap-8">
          <div>
            <div className="font-mono text-[10px] th-text-ghost uppercase tracking-wider mb-1">{t("ts13EmailLabel")}</div>
            <a href="mailto:contact@thaink2.com" className="text-sm text-[#38bdf8] hover:underline">
              contact@thaink2.com
            </a>
          </div>
          <div>
            <div className="font-mono text-[10px] th-text-ghost uppercase tracking-wider mb-1">{t("ts13PlatformLabel")}</div>
            <a href="https://agent-dev.thaink2.fr/" target="_blank" rel="noopener noreferrer" className="text-sm text-[#38bdf8] hover:underline">
              agent-dev.thaink2.fr
            </a>
          </div>
          <div>
            <div className="font-mono text-[10px] th-text-ghost uppercase tracking-wider mb-1">{t("ts13WebsiteLabel")}</div>
            <a href="https://www.thaink2.com" target="_blank" rel="noopener noreferrer" className="text-sm text-[#38bdf8] hover:underline">
              www.thaink2.com
            </a>
          </div>
        </div>
      </Section>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════ */
function Footer() {
  const t = useTranslations("Legal");
  return (
    <footer className="border-t th-border py-6">
      <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-3">
        <span className="font-mono text-xs th-text-ghost">{t("footerCopyright")}</span>
        <div className="flex gap-4 font-mono text-xs">
          <a href="https://agent.thaink2.fr/" target="_blank" rel="noopener noreferrer" className="th-text-ghost hover:th-text-muted transition-colors">
            TH2 Agent Studio
          </a>
          <a href="https://www.thaink2.com" target="_blank" rel="noopener noreferrer" className="th-text-ghost hover:th-text-muted transition-colors">
            thaink2.fr
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN LEGAL PAGE
   ═══════════════════════════════════════════════════════════ */
export default function LegalPage() {
  const t = useTranslations("Legal");

  const TABS = [
    { key: "privacy", label: t("tabPrivacyPolicy"), icon: Shield },
    { key: "terms", label: t("tabTermsOfService"), icon: FileText },
  ];

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return "privacy";
    const hash = window.location.hash.replace("#", "");
    return (hash === "terms" || hash === "privacy") ? hash : "privacy";
  });

  return (
    <div className="min-h-screen th-bg-body th-text selection:bg-brand/30 selection:text-white">
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(110,231,183,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(110,231,183,0.025) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <Navbar />

      <main className="relative z-1 max-w-3xl mx-auto px-6 py-16">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-12 p-1 rounded-xl th-bg-surface border th-border w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  window.history.replaceState(null, "", `#${tab.key}`);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-[#6ee7b7]/10 text-[#6ee7b7] border border-[#6ee7b7]/20"
                    : "th-text-faint hover:th-text-muted border border-transparent"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {activeTab === "privacy" ? <PrivacyPolicyContent /> : <TermsOfServiceContent />}
      </main>

      <Footer />
    </div>
  );
}
