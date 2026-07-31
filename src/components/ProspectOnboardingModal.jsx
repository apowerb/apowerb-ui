"use client";

import { useCallback, useEffect, useState } from "react";
import { getProspectionProfile, setProspectionProfile } from "@/lib/api";

/**
 * Onboarding th2prospect — etape 0 (profil emetteur).
 *
 * Auto-contenu : ecoute l'evenement `th2prospect:agent-created` (emis a la
 * creation d'un agent th2prospect). Il ne s'affiche QUE si le profil emetteur
 * de l'utilisateur n'existe pas encore (le profil est 1/user, owner-scope).
 * A la validation, persiste le profil via l'endpoint deterministe -> l'agent
 * saute l'etape 0 en chat. Demande d'Anis (10/06).
 */
const FIELDS = [
  { key: "company_name", label: "Nom de votre entreprise", required: true, placeholder: "ex : thaink2" },
  { key: "activity", label: "Votre activite (ce que vous faites)", placeholder: "ex : conseil en data et IA" },
  { key: "value_proposition", label: "Votre offre / proposition de valeur", placeholder: "ex : automatiser les process des PME" },
];

export default function ProspectOnboardingModal() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    activity: "",
    value_proposition: "",
  });

  useEffect(() => {
    const onCreated = async () => {
      try {
        const res = await getProspectionProfile();
        const p = res?.profile || {};
        // Pre-remplit avec le profil existant (vide si nouveau). Le modal
        // s'affiche A CHAQUE creation d'agent th2prospect pour revoir/corriger
        // l'etape 0 (choix produit : pre-rempli, modifiable).
        setForm({
          company_name: p.company_name || "",
          activity: p.activity || "",
          value_proposition: p.value_proposition || "",
        });
      } catch {
        // Silencieux : un echec de lecture ne bloque pas l'affichage.
      }
      setOpen(true);
    };
    window.addEventListener("th2prospect:agent-created", onCreated);
    return () => window.removeEventListener("th2prospect:agent-created", onCreated);
  }, []);

  const submit = useCallback(async () => {
    if (!form.company_name.trim()) return;
    setSaving(true);
    try {
      await setProspectionProfile({
        company_name: form.company_name.trim(),
        activity: form.activity.trim() || null,
        value_proposition: form.value_proposition.trim() || null,
      });
      setOpen(false);
    } catch {
      // L'utilisateur pourra toujours decrire son entreprise en chat (etape 0).
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }, [form]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prospect-onboarding-title"
      style={{ background: "var(--bg-overlay)" }}
    >
      <div className="glass-modal rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl animate-scale-up-center">
        <h2 id="prospect-onboarding-title" className="text-xl font-semibold mb-1">
          Bienvenue dans votre agent de prospection
        </h2>
        <p className="text-sm opacity-70 mb-5">
          Pour personnaliser vos emails, commencons par votre entreprise. Vous
          pourrez modifier ces informations plus tard.
        </p>

        <div className="space-y-4">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="text-sm font-medium">
                {f.label}
                {f.required ? <span className="text-red-500"> *</span> : null}
              </span>
              <input
                type="text"
                value={form[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm opacity-60 hover:opacity-100"
          >
            Plus tard
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !form.company_name.trim()}
            className="rounded-xl bg-brand text-white px-5 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer et continuer"}
          </button>
        </div>
      </div>
    </div>
  );
}
