"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import {
  KeyRound,
  Loader2,
  MailCheck,
  LogOut,
  MoreHorizontal,
  Plus,
  ShieldOff,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  addAdminGroupMember,
  deleteAdminUser,
  demandEmailVerification,
  demandPasswordReset,
  disableAdminUserMfa,
  forceRelogin,
  setMfaRequired,
  getAdminContext,
  changeAdminUserRole,
  createAdminGroup,
  createAdminUser,
  deleteAdminGroup,
  listAdminGroups,
  listAdminPermissions,
  listAdminUsers,
  removeAdminGroupMember,
  setAdminGroupPermissions,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminUser } from "@/lib/roles";
import { Skeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import DashboardTab from "@/components/admin/DashboardTab";

// "SUPERADMIN" is not a value of the core's role enum — it is ADMIN plus a
// row in admin_superadmin. The API accepts it here and writes both sides, so
// this stays one decision rather than two controls to keep in sync.
const ROLES = ["USER", "ADMIN", "SUPERADMIN"];

/** What the selector should show for a user: the core role, unless they are
 *  also listed as a superadmin. */
function roleValue(user) {
  return user.superadmin ? "SUPERADMIN" : user.role;
}

/** A group's permissions, as a folded multi-select — the same shape the
 *  evaluators picker uses, so the two admin-ish screens read alike. */
function PermissionPicker({ catalog, selected, onToggle, t }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl th-bg-input border th-border th-text text-sm hover:th-bg-surface-hover min-w-[210px] justify-between"
      >
        <span>{t("permissionsSelected", { count: selected.size })}</span>
      </button>
      {open && (
        <>
          {/* Click-away without a document listener: the overlay is the
              listener, and it cannot leak if the component unmounts. */}
          <button
            type="button"
            aria-label={t("close")}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 mt-1 w-80 th-bg-modal rounded-xl shadow-2xl py-1.5 max-h-72 overflow-y-auto border th-border">
            {catalog.map((permission) => (
              <label
                key={permission.name}
                className="flex items-start gap-2 px-3 py-2 text-xs th-text cursor-pointer hover:th-bg-surface-hover"
              >
                <input
                  type="checkbox"
                  checked={selected.has(permission.name)}
                  onChange={() => onToggle(permission.name)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block">{permission.label}</span>
                  <code className="th-text-faint text-[10px]">{permission.name}</code>
                </span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  const t = useTranslations("Admin");
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [permissions, setPermissions] = useState([]);
  // What this administrator may do. A filtered list looks exactly like a
  // small one, so the screen is told rather than left to infer.
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [tab, setTab] = useState("dashboard");
  const [newUser, setNewUser] = useState({
    email: "", firstName: "", lastName: "", password: "", role: "USER",
  });
  const [newGroup, setNewGroup] = useState({ name: "", description: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, g, p, ctx] = await Promise.all([
        listAdminUsers(), listAdminGroups(), listAdminPermissions(), getAdminContext(),
      ]);
      setUsers(u || []);
      setGroups(g || []);
      setPermissions(p || []);
      setContext(ctx || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byId = useMemo(
    () => Object.fromEntries(users.map((u) => [u.user_id, u])),
    [users],
  );

  // A role can be revoked while this tab stays open, so the screen has to
  // handle 403 rather than assume the nav gate still holds.
  if (!isAdminUser(user)) {
    return (
      <div className="p-6">
        <EmptyState icon={ShieldCheck} title={t("forbiddenTitle")} description={t("forbiddenBody")} />
      </div>
    );
  }

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const canCreateUser =
    newUser.email.trim() && newUser.firstName.trim() &&
    newUser.lastName.trim() && newUser.password.length >= 8;

  return (
    // Same shell as the other dashboard screens: a fixed header and a body
    // that scrolls. Without it the list simply ran off the bottom.
    <div className="flex flex-col h-full">
      <div className="shrink-0 p-6 pb-0 max-w-6xl mx-auto w-full">
      <header className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-2xl btn-brand">
          <ShieldCheck size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold th-text">{t("title")}</h1>
          <p className="text-sm th-text-muted">
            {context
              ? context.superadmin
                ? t("scopeSuperadmin")
                : context.organization
                  ? t("scopeOrg", { org: context.organization.name })
                  : t("scopeBounded")
              : t("subtitle")}
          </p>
        </div>
        <button
          onClick={load}
          disabled={busy}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl border th-border th-bg-surface th-text text-sm font-medium hover:th-bg-surface-hover disabled:opacity-50"
        >
          <RefreshCw size={15} />
          {t("refresh")}
        </button>
      </header>

      <div className="flex gap-2 mb-5">
        {["dashboard", "users", "groups"].map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border ${
              tab === key
                ? "btn-brand border-transparent"
                : "th-bg-surface th-border th-text hover:th-bg-surface-hover"
            }`}
          >
            {t(
              key === "dashboard"
                ? "tabDashboard"
                : key === "users"
                  ? "tabUsers"
                  : "tabGroups",
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl border th-border th-bg-surface text-sm text-red-400">
          {error}
        </div>
      )}

      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 max-w-6xl mx-auto w-full">
      {loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : tab === "users" ? (
        <UsersTab
          t={t}
          users={users}
          me={user}
          busy={busy}
          newUser={newUser}
          setNewUser={setNewUser}
          canCreate={canCreateUser}
          onCreate={() =>
            run(async () => {
              await createAdminUser(newUser);
              setNewUser({ email: "", firstName: "", lastName: "", password: "", role: "USER" });
            })
          }
          onRoleChange={(userId, role) => run(() => changeAdminUserRole(userId, role))}
          onAct={(fn) => run(fn)}
        />
      ) : tab === "dashboard" ? (
        <DashboardTab />
      ) : (
        <GroupsTab
          t={t}
          groups={groups}
          users={users}
          byId={byId}
          permissions={permissions}
          busy={busy}
          newGroup={newGroup}
          setNewGroup={setNewGroup}
          onCreate={() =>
            run(async () => {
              await createAdminGroup(newGroup);
              setNewGroup({ name: "", description: "" });
            })
          }
          onDelete={(groupId) => run(() => deleteAdminGroup(groupId))}
          onTogglePermission={(group, name) =>
            run(() => {
              const next = new Set(group.permissions);
              next.has(name) ? next.delete(name) : next.add(name);
              return setAdminGroupPermissions(group.group_id, [...next]);
            })
          }
          onAddMember={(groupId, userId) => run(() => addAdminGroupMember(groupId, userId))}
          onRemoveMember={(groupId, userId) => run(() => removeAdminGroupMember(groupId, userId))}
        />
      )}
      </div>
    </div>
  );
}

/** A short definition, on hover and on keyboard focus.
 *
 *  Every label on this screen is a word standing in for a rule — "signup
 *  never used" means an account with no LLM call and no agent, which
 *  no amount of column width would have conveyed. The hint carries the
 *  sentence; the label keeps the word.
 *
 *  `title` is deliberately kept as well: it is what a screen reader and a
 *  touch device get, and it costs nothing.
 */
function Hint({ label, children, className = "", focusable = false }) {
  return (
    <span
      className={`relative inline-flex items-center group ${className}`}
      // Only where the definition earns a tab stop. Three badges over
      // thirty rows would put ninety stops between a keyboard user and
      // the next control; `title` still carries the text for them.
      tabIndex={focusable ? 0 : undefined}
      title={label}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-50 hidden group-hover:block group-focus:block w-56 px-2.5 py-1.5 rounded-lg th-bg-modal border th-border shadow-2xl text-[11px] font-normal th-text-secondary leading-snug text-left normal-case tracking-normal"
      >
        {label}
      </span>
    </span>
  );
}

/** A status badge that explains itself. */
function StatusChip({ tone = "neutral", label, children }) {
  const tones = {
    warn: "bg-[var(--c-amber-500-15)] text-amber-600 dark:text-amber-400",
    good: "bg-[var(--c-emerald-500-15)] text-emerald-600 dark:text-emerald-400",
    neutral: "th-bg-elevated border th-border th-text-faint",
  };
  return (
    <Hint label={label}>
      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold cursor-help ${tones[tone]}`}>
        {children}
      </span>
    </Hint>
  );
}

function initials(user) {
  return `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase() || "?";
}

function compact(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

/** What an administrator can demand of one account.
 *
 *  Every entry rides a flow the core already owns. Two things an
 *  administrator deliberately cannot do: set someone's password (they could
 *  then sign in as them — only a reset link is sent), and enable MFA for
 *  them (the secret is born when they scan the QR code, so a secret an
 *  administrator knows is not a second factor).
 */
function UserActions({ user, isMe, busy, onAct, t }) {
  const [open, setOpen] = useState(false);

  const act = (fn, confirmLabel) => {
    if (confirmLabel && !window.confirm(confirmLabel)) return;
    setOpen(false);
    onAct(fn);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-label={t("actionsFor", { email: user.email })}
        className="p-1.5 rounded-lg th-text-faint hover:th-text hover:th-bg-surface-hover disabled:opacity-40"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label={t("close")}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 w-64 th-bg-modal border th-border rounded-xl shadow-2xl py-1">
            <button
              type="button"
              onClick={() => act(() => demandPasswordReset(user.user_id))}
              className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs th-text hover:th-bg-surface-hover"
            >
              <KeyRound size={13} className="mt-0.5 shrink-0" />
              <span>
                {t("actResetPassword")}
                <span className="block th-text-faint text-[10px]">{t("actResetPasswordHint")}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => act(() => demandEmailVerification(user.user_id))}
              className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs th-text hover:th-bg-surface-hover"
            >
              <MailCheck size={13} className="mt-0.5 shrink-0" />
              <span>
                {t("actRequireVerification")}
                <span className="block th-text-faint text-[10px]">{t("actRequireVerificationHint")}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => act(() => forceRelogin(user.user_id), t("confirmForceRelogin", { email: user.email }))}
              className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs th-text hover:th-bg-surface-hover"
            >
              <LogOut size={13} className="mt-0.5 shrink-0" />
              <span>
                {t("actForceRelogin")}
                <span className="block th-text-faint text-[10px]">{t("actForceReloginHint")}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => act(() => setMfaRequired(user.user_id, !user.mfa_required))}
              className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs th-text hover:th-bg-surface-hover"
            >
              <ShieldCheck size={13} className="mt-0.5 shrink-0" />
              <span>
                {user.mfa_required ? t("actStopRequiringMfa") : t("actRequireMfa")}
                <span className="block th-text-faint text-[10px]">
                  {user.mfa_required ? t("actStopRequiringMfaHint") : t("actRequireMfaHint")}
                </span>
              </span>
            </button>
            {user.mfa_enabled && (
              <button
                type="button"
                onClick={() => act(() => disableAdminUserMfa(user.user_id), t("confirmDisableMfa", { email: user.email }))}
                className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs th-text hover:th-bg-surface-hover"
              >
                <ShieldOff size={13} className="mt-0.5 shrink-0" />
                <span>
                  {t("actDisableMfa")}
                  <span className="block th-text-faint text-[10px]">{t("actDisableMfaHint")}</span>
                </span>
              </button>
            )}
            {!isMe && (
              <button
                type="button"
                onClick={() => act(() => deleteAdminUser(user.user_id), t("confirmDeleteUser", { email: user.email }))}
                className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs text-red-400 hover:th-bg-surface-hover border-t th-border mt-1 pt-2"
              >
                <Trash2 size={13} className="mt-0.5 shrink-0" />
                <span>
                  {t("actDeleteUser")}
                  <span className="block th-text-faint text-[10px]">{t("actDeleteUserHint")}</span>
                </span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function UsersTab({ t, users, me, busy, newUser, setNewUser, canCreate, onCreate, onRoleChange, onAct }) {
  const field = "px-3 py-2 rounded-xl th-bg-input border th-border th-text text-sm focus:outline-none focus:border-brand";
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const shown = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${u.email} ${u.first_name} ${u.last_name} ${(u.groups || []).join(" ")}`
      .toLowerCase()
      .includes(q);
  });

  const admins = users.filter((u) => u.role === "ADMIN").length;
  // Never used: no LLM call and no agent. That is a dormant invitation or
  // a fixture — something to clean up. `onboarding_completed`, which this
  // used to count, only says whether somebody closed the welcome tour.
  const neverUsed = users.filter((u) => !u.llm_calls && !u.agents).length;

  return (
    <>
      {/* Counters first: they are the reading of the list, not decoration.
          "22 of 30 never finished signing up" is the kind of thing an
          administrator needs before scrolling anywhere. */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <input
          className={`${field} flex-1 min-w-56`}
          placeholder={t("searchUsers")}
          aria-label={t("searchUsers")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Hint label={t("countsHint")}>
          <span className="text-xs th-text-muted whitespace-nowrap cursor-help">
            {t("userCounts", { total: users.length, admins, neverUsed })}
          </span>
        </Hint>
        <button
          onClick={() => setAdding((a) => !a)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl btn-brand text-sm font-semibold"
        >
          <UserPlus size={15} />
          {t("createUser")}
        </button>
      </div>

      {/* Folded away by default: adding a user is occasional, reading the
          list is constant. */}
      {adding && (
        <section className="mb-5 p-4 rounded-2xl border th-border th-bg-surface">
          <div className="flex flex-wrap gap-2">
            <input
              className={`${field} w-64`} type="email" autoComplete="off"
              placeholder={t("email")} aria-label={t("email")}
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
            <input
              className={`${field} w-40`} placeholder={t("firstName")} aria-label={t("firstName")}
              value={newUser.firstName}
              onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
            />
            <input
              className={`${field} w-40`} placeholder={t("lastName")} aria-label={t("lastName")}
              value={newUser.lastName}
              onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
            />
            {/* Typed by the administrator, hashed server-side, never read
                back by any response. */}
            <input
              className={`${field} w-52`} type="password" autoComplete="new-password"
              placeholder={t("passwordHint")} aria-label={t("passwordHint")}
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
            <select
              className={`${field} w-32`} aria-label={t("role")}
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{t(`role_${r}`)}</option>
              ))}
            </select>
            <button
              onClick={onCreate}
              disabled={busy || !canCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl btn-brand text-sm font-semibold disabled:opacity-40"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {t("create")}
            </button>
          </div>
          {newUser.password && newUser.password.length < 8 && (
            <p className="mt-2 text-xs th-text-faint">{t("passwordTooShort")}</p>
          )}
        </section>
      )}

      {/* No `overflow-hidden` here: it would clip the header hints,
          which are anchored above the row. The rounding lives on the
          table instead, so the corners survive. */}
      <div className="rounded-2xl border th-border">
        <table className="w-full text-sm rounded-2xl overflow-hidden">
          <thead className="th-bg-surface">
            <tr className="th-text-muted text-xs">
              <th className="text-left font-medium px-4 py-3">{t("userHeader")}</th>
              <th className="text-left font-medium px-4 py-3">
                <Hint label={t("groupsHint")} focusable>
                  <span className="cursor-help border-b border-dotted th-border">{t("groups")}</span>
                </Hint>
              </th>
              <th className="text-right font-medium px-4 py-3">
                <Hint label={t("agentsHint")} className="justify-end" focusable>
                  <span className="cursor-help border-b border-dotted th-border">{t("agentsHeader")}</span>
                </Hint>
              </th>
              <th className="text-right font-medium px-4 py-3">
                <Hint label={t("usageHint")} className="justify-end" focusable>
                  <span className="cursor-help border-b border-dotted th-border">{t("usageHeader")}</span>
                </Hint>
              </th>
              <th className="text-left font-medium px-4 py-3">
                <Hint label={t("statusHint")} focusable>
                  <span className="cursor-help border-b border-dotted th-border">{t("statusHeader")}</span>
                </Hint>
              </th>
              <th className="text-left font-medium px-4 py-3">
                <Hint label={t("roleHint")} focusable>
                  <span className="cursor-help border-b border-dotted th-border">{t("role")}</span>
                </Hint>
              </th>
              <th className="w-10 px-2 py-3"><span className="sr-only">{t("actionsHeader")}</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => {
              const isMe = u.email === me?.email;
              return (
                <tr key={u.user_id} className="border-t th-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="shrink-0 w-8 h-8 rounded-full th-bg-elevated border th-border flex items-center justify-center text-[11px] font-bold th-text-secondary">
                        {initials(u)}
                      </span>
                      <span className="min-w-0">
                        <span className="block th-text truncate">
                          {u.first_name} {u.last_name}
                        </span>
                        <span className="block th-text-faint text-xs truncate">{u.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 th-text-faint text-xs">
                    {u.groups?.length ? u.groups.join(", ") : "—"}
                  </td>
                  {/* What they built and what it cost: the two numbers that
                      separate a colleague from a leftover fixture. */}
                  <td className="px-4 py-3 text-right th-text-secondary tabular-nums">
                    {u.agents || (
                      <Hint label={t("noneHint")} className="justify-end">
                        <span className="th-text-ghost cursor-help">—</span>
                      </Hint>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right th-text-secondary tabular-nums text-xs">
                    {u.tokens ? (
                      <Hint label={t("tokensHint", { calls: u.llm_calls })} className="justify-end">
                        <span className="cursor-help">{t("tokensShort", { tokens: compact(u.tokens) })}</span>
                      </Hint>
                    ) : (
                      <Hint label={t("noneHint")} className="justify-end">
                        <span className="th-text-ghost cursor-help">—</span>
                      </Hint>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      {!u.email_verified && (
                        <StatusChip tone="warn" label={t("unverifiedHint")}>
                          {t("unverifiedBadge")}
                        </StatusChip>
                      )}
                      {!u.llm_calls && !u.agents && (
                        <StatusChip tone="warn" label={t("dormantHint")}>
                          {t("dormantBadge")}
                        </StatusChip>
                      )}
                      {u.mfa_required && !u.mfa_enabled && (
                        <StatusChip tone="warn" label={t("mfaDemandedHint")}>
                          {t("mfaDemandedBadge")}
                        </StatusChip>
                      )}
                      {u.mfa_enabled && (
                        <StatusChip tone="good" label={t("mfaHint")}>
                          {t("mfaBadge")}
                        </StatusChip>
                      )}
                      {u.sign_in !== "password" && (
                        <StatusChip label={t("signInHint", { provider: u.sign_in })}>
                          {u.sign_in}
                        </StatusChip>
                      )}
                      {/* The dash is the "nothing to report" case, so it is
                          the negation of every chip above — and every term is
                          a boolean, because JSX draws a falsy *number*: with
                          no calls and no agents, `(0 || 0)` printed a bare 0
                          next to the badge. */}
                      {u.email_verified &&
                        Boolean(u.llm_calls || u.agents) &&
                        !u.mfa_enabled &&
                        u.sign_in === "password" && (
                          <span className="th-text-ghost text-xs">—</span>
                        )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={roleValue(u)}
                      aria-label={t("roleOf", { email: u.email })}
                      /* An administrator cannot strip their own role: the last
                         one to do it would lock everyone out of this screen.
                         The server refuses it too — this only spares the trip. */
                      disabled={busy || isMe}
                      onChange={(e) => onRoleChange(u.user_id, e.target.value)}
                      className="px-3 py-1.5 rounded-lg th-bg-input border th-border th-text text-xs disabled:opacity-40"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{t(`role_${r}`)}</option>
                      ))}
                    </select>
                    {isMe && (
                      <Hint label={t("thatIsYouHint")}>
                        <span className="ml-2 text-[10px] th-text-faint cursor-help">{t("thatIsYou")}</span>
                      </Hint>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <UserActions user={u} isMe={isMe} busy={busy} onAct={onAct} t={t} />
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center th-text-faint text-sm">
                  {t("noUserMatches", { query })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function GroupsTab({
  t, groups, users, byId, permissions, busy, newGroup, setNewGroup,
  onCreate, onDelete, onTogglePermission, onAddMember, onRemoveMember,
}) {
  const field = "px-3 py-2 rounded-xl th-bg-input border th-border th-text text-sm focus:outline-none focus:border-brand";
  const [pending, setPending] = useState({});

  return (
    <>
      <section className="mb-6 p-4 rounded-2xl border th-border th-bg-surface">
        <h2 className="text-sm font-bold th-text mb-3 flex items-center gap-2">
          <Users size={16} /> {t("createGroup")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${field} w-56`} placeholder={t("groupName")} aria-label={t("groupName")}
            value={newGroup.name}
            onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
          />
          <input
            className={`${field} w-96`} placeholder={t("groupDescription")} aria-label={t("groupDescription")}
            value={newGroup.description}
            onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
          />
          <button
            onClick={onCreate}
            disabled={busy || !newGroup.name.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl btn-brand text-sm font-semibold disabled:opacity-40"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {t("create")}
          </button>
        </div>
      </section>

      {groups.length === 0 ? (
        <EmptyState icon={Users} title={t("noGroupTitle")} description={t("noGroupBody")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => {
            const selected = new Set(group.permissions);
            return (
              <div key={group.group_id} className="p-4 rounded-2xl border th-border th-bg-surface">
                <div className="flex items-start gap-2 mb-3">
                  <div>
                    <h3 className="font-bold th-text">{group.name}</h3>
                    {group.description && (
                      <p className="text-xs th-text-muted">{group.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onDelete(group.group_id)}
                    disabled={busy}
                    aria-label={t("deleteGroupOf", { name: group.name })}
                    className="ml-auto p-2 rounded-lg th-text-faint hover:text-red-400 hover:th-bg-surface-hover disabled:opacity-40"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="mb-3">
                  <span className="block text-xs font-bold th-text-muted mb-1.5">
                    {t("permissions")}
                  </span>
                  <PermissionPicker
                    catalog={permissions}
                    selected={selected}
                    onToggle={(name) => onTogglePermission(group, name)}
                    t={t}
                  />
                  {group.permissions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {group.permissions.map((name) => (
                        <span
                          key={name}
                          className="px-2 py-0.5 rounded-md th-bg-elevated border th-border text-[10px] th-text-secondary"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <span className="block text-xs font-bold th-text-muted mb-1.5">
                  {t("members", { count: group.members.length })}
                </span>
                <div className="flex flex-wrap gap-1 mb-2">
                  {group.members.map((userId) => (
                    <span
                      key={userId}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg th-bg-elevated border th-border text-xs th-text"
                    >
                      {byId[userId]?.email ?? `#${userId}`}
                      <button
                        onClick={() => onRemoveMember(group.group_id, userId)}
                        disabled={busy}
                        aria-label={t("removeMemberOf", {
                          email: byId[userId]?.email ?? String(userId),
                          name: group.name,
                        })}
                        className="th-text-faint hover:text-red-400 disabled:opacity-40"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <select
                    className={`${field} flex-1 text-xs`}
                    aria-label={t("addMemberTo", { name: group.name })}
                    value={pending[group.group_id] ?? ""}
                    onChange={(e) =>
                      setPending({ ...pending, [group.group_id]: e.target.value })
                    }
                  >
                    <option value="">{t("chooseMember")}</option>
                    {users
                      .filter((u) => !group.members.includes(u.user_id))
                      .map((u) => (
                        <option key={u.user_id} value={u.user_id}>{u.email}</option>
                      ))}
                  </select>
                  <button
                    onClick={() => {
                      const picked = pending[group.group_id];
                      if (!picked) return;
                      onAddMember(group.group_id, Number(picked));
                      setPending({ ...pending, [group.group_id]: "" });
                    }}
                    disabled={busy || !pending[group.group_id]}
                    className="px-3 py-2 rounded-xl btn-brand text-xs font-semibold disabled:opacity-40"
                  >
                    {t("addMember")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
