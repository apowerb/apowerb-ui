"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "@/lib/navigation";
import { useTranslations } from "use-intl";
import {
  Sparkles,
  Users,
  PlugZap,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  X,
  Check,
  Loader2,
} from "lucide-react";

function getSteps(t) {
  return [
    {
      id: "welcome",
      icon: Sparkles,
      title: t("welcomeTitle"),
      description: t("welcomeDescription"),
      primaryLabel: t("letsGoLabel"),
    },
    {
      id: "agent",
      icon: Users,
      title: t("agentTitle"),
      description: t("agentDescription"),
      primaryLabel: t("nextLabel"),
    },
    {
      id: "integration",
      icon: PlugZap,
      title: t("integrationTitle"),
      description: t("integrationDescription"),
      primaryLabel: t("nextLabel"),
    },
    {
      id: "chat",
      icon: MessageSquare,
      title: t("chatTitle"),
      description: t("chatDescription"),
      primaryLabel: t("gotItLabel"),
    },
  ];
}

export default function OnboardingTour({
  onClose,
  onCreateStarterAgent,
  canCreateStarter = false,
  creatingStarter = false,
}) {
  const router = useRouter();
  const t = useTranslations("OnboardingTour");
  const STEPS = useMemo(() => getSteps(t), [t]);
  const [stepIndex, setStepIndex] = useState(0);
  const dialogRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, [stepIndex]);

  const step = STEPS[stepIndex];
  const Icon = step.icon;
  const isLast = stepIndex === STEPS.length - 1;
  const isFirst = stepIndex === 0;

  const handleNext = () => {
    if (isLast) {
      onClose();
      router.push("/chat");
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const handlePrev = () => {
    if (isFirst) return;
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleStarter = async () => {
    if (!onCreateStarterAgent) return;
    await onCreateStarterAgent();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      style={{ background: "var(--bg-overlay)" }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="glass-modal rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl animate-scale-up-center focus:outline-none"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIndex
                    ? "w-8 bg-brand"
                    : i < stepIndex
                      ? "w-4 bg-brand/60"
                      : "w-4 bg-slate-300 dark:bg-white/15"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeOnboardingAriaLabel")}
            className="p-1.5 rounded-lg th-text-faint hover:th-text hover:th-bg-surface-hover transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-brand to-brand-secondary flex items-center justify-center mb-4 shadow-lg">
            <Icon size={28} className="text-white" />
          </div>
          <h2
            id="onboarding-title"
            className="text-xl md:text-2xl font-bold th-text mb-2"
          >
            {step.title}
          </h2>
          <p className="text-sm th-text-muted max-w-sm">{step.description}</p>
        </div>

        {step.id === "agent" && canCreateStarter && (
          <div className="mb-5">
            <button
              type="button"
              onClick={handleStarter}
              disabled={creatingStarter}
              className="w-full inline-flex items-center justify-center gap-2 p-3 rounded-xl border border-brand/40 bg-brand/5 hover:bg-brand/10 th-text text-sm font-medium transition-colors disabled:opacity-60"
            >
              {creatingStarter ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t("creatingStarterAgentLabel")}
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-brand" />
                  {t("createStarterForMeLabel")}
                </>
              )}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm th-text-faint hover:th-text transition-colors"
          >
            {t("skipTourLabel")}
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-4 py-2 rounded-xl text-sm th-text th-bg-surface hover:th-bg-surface-hover border th-border transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft size={14} />
                {t("backLabel")}
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="btn-brand px-5 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
            >
              {step.primaryLabel}
              {isLast ? <Check size={14} /> : <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
