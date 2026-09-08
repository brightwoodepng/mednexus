"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BarChart3,
  CalendarClock,
  Download,
  Gift,
  History,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Trophy,
  X,
} from "lucide-react";

type Season = {
  id: string;
  name: string;
  economy_version: string;
  status: "planned" | "active" | "closed";
  starts_at: string;
  ends_at: string | null;
  opening_grant: number;
  minimum_eligible_questions: number;
  monthly_rewards: number[];
  seasonal_rewards: number[];
  member_count: number;
  currency_supply: string;
  currency_earned: string;
};
type Config = {
  version: string;
  npConfig: Record<string, unknown>;
  xpConfig: Record<string, unknown>;
};
type Run = {
  id: string;
  reward_type: string;
  period_key: string;
  eligible_count: number;
  excluded_count: number;
  total_np: string;
  executed_at: string;
  recipients: Array<{
    userId: string;
    place: number;
    score: string;
    npAmount: number;
  }>;
};
type GiftRow = {
  id: string;
  index_number: string;
  name: string | null;
  amount: number;
  reason: string;
  batch_id: string | null;
  created_at: string;
};
type Learner = {
  uid: string;
  name: string;
  index_number: string;
  balance: number;
};
type Data = {
  seasons: Season[];
  activeSeason: Season | null;
  dryRunReport: { approved_users: number; ineligible_users: number };
  config: Config;
  rewardRuns: Run[];
  gifts: GiftRow[];
  learners: Learner[];
};
type Tab =
  | "overview"
  | "seasons"
  | "rewards"
  | "rules"
  | "gifts"
  | "history"
  | "reports";
const tabs: Array<[Tab, string, typeof BarChart3]> = [
  ["overview", "Overview", BarChart3],
  ["seasons", "Seasons", CalendarClock],
  ["rewards", "Rewards", Trophy],
  ["rules", "NP & XP Rules", Settings2],
  ["gifts", "Gift NP", Gift],
  ["history", "History", History],
  ["reports", "Reports", Download],
];
const control =
  "min-h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:pointer-events-none disabled:opacity-40";
const card = "rounded-2xl border border-border bg-card p-5 shadow-sm";

export function EconomySeasonsWorkspace({ canReset }: { canReset: boolean }) {
  const [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [tab, setTab] = useState<Tab>("overview");
  const [creating, setCreating] = useState(false),
    [editing, setEditing] = useState<Season | null>(null),
    [activating, setActivating] = useState<Season | null>(null),
    [impact, setImpact] = useState<Record<string, number> | null>(null),
    [confirmation, setConfirmation] = useState("");
  const [name, setName] = useState(""),
    [version, setVersion] = useState(""),
    [openingGrant, setOpeningGrant] = useState(500),
    [startsAt, setStartsAt] = useState(""),
    [minimum, setMinimum] = useState(300),
    [monthly, setMonthly] = useState([500, 300, 200, 100]),
    [seasonal, setSeasonal] = useState([3000, 2000, 1000, 250]);
  const previousMonth = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1),
  )
    .toISOString()
    .slice(0, 7);
  const [month, setMonth] = useState(previousMonth),
    [monthPreview, setMonthPreview] = useState<Record<string, unknown> | null>(
      null,
    ),
    [payoutConfirmation, setPayoutConfirmation] = useState("");
  const [activeMinimum, setActiveMinimum] = useState(300),
    [activeMonthly, setActiveMonthly] = useState<number[]>([]),
    [activeSeasonal, setActiveSeasonal] = useState<number[]>([]);
  const [npConfig, setNPConfig] = useState<Record<string, unknown>>({}),
    [xpConfig, setXPConfig] = useState<Record<string, unknown>>({}),
    [configReason, setConfigReason] = useState(""),
    [configPreview, setConfigPreview] = useState<
      Array<{ path: string; before: unknown; after: unknown }>
    >([]),
    [configConfirmation, setConfigConfirmation] = useState("");
  const [giftPreview, setGiftPreview] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [learnerQuery, setLearnerQuery] = useState(""),
    [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]),
    [giftAmount, setGiftAmount] = useState(100),
    [giftReason, setGiftReason] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/economy-seasons", {
          cache: "no-store",
        }),
        body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Unable to load Economy Seasons.");
      setData(body);
      setNPConfig(body.config.npConfig);
      setXPConfig(body.config.xpConfig);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load Economy Seasons.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const saved = sessionStorage.getItem("mednexus-economy-tab") as Tab | null;
    if (saved && tabs.some(([id]) => id === saved)) setTab(saved);
  }, [load]);
  useEffect(() => {
    if (data?.activeSeason) {
      setActiveMinimum(data.activeSeason.minimum_eligible_questions);
      setActiveMonthly(data.activeSeason.monthly_rewards);
      setActiveSeasonal(data.activeSeason.seasonal_rewards);
    }
  }, [data?.activeSeason]);
  const choose = (next: Tab) => {
    setTab(next);
    sessionStorage.setItem("mednexus-economy-tab", next);
  };
  const request = async (body: Record<string, unknown>, key: string) => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/economy-seasons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.error ?? "Economy operation failed.");
      if (result.seasons) setData(result);
      return result;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Economy operation failed.",
      );
      return null;
    } finally {
      setBusy("");
    }
  };
  const visibleLearners = useMemo(() => {
    const query = learnerQuery.trim().toLowerCase();
    if (!query) return data?.learners ?? [];
    return (data?.learners ?? []).filter(
      (learner) =>
        learner.name.toLowerCase().includes(query) ||
        learner.index_number.toLowerCase().includes(query),
    );
  }, [data?.learners, learnerQuery]);
  if (loading && !data)
    return (
      <div role="status" className="grid min-h-64 place-items-center">
        <Loader2 className="animate-spin text-primary" />
        <span className="sr-only">Loading Economy Seasons</span>
      </div>
    );
  if (!data)
    return (
      <div
        role="alert"
        className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive"
      >
        <p>{error || "Economy Seasons is unavailable."}</p>
        <button onClick={() => void load()} className={`${button} mt-4 border`}>
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  const active = data.activeSeason;
  return (
    <main className="mx-auto w-full max-w-7xl space-y-5">
      <header className="border-b border-border pb-4">
        <nav
          aria-label="Economy sections"
          className="flex gap-1 overflow-x-auto"
        >
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => choose(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-bold ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700"
        >
          {notice}
        </div>
      )}
      {!canReset && (
        <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
          Economy changes require super administrator access. This workspace is
          read-only.
        </div>
      )}

      {tab === "overview" && (
        <div className="space-y-5">
          <section className={card}>
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-emerald-600">
                  Active season
                </p>
                <h2 className="text-2xl font-bold">
                  {active?.name ?? "No active season"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Economy {active?.economy_version ?? "—"} ·{" "}
                  {active
                    ? `Started ${date(active.starts_at)}`
                    : "Plan a season to begin"}
                </p>
              </div>
              {active && (
                <span className="h-fit rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
                  Active
                </span>
              )}
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
              <Stat label="Learners" value={data.dryRunReport.approved_users} />
              <Stat
                label="NP supply"
                value={Number(active?.currency_supply ?? 0).toLocaleString()}
              />
              <Stat
                label="NP awarded"
                value={Number(active?.currency_earned ?? 0).toLocaleString()}
              />
              <Stat
                label="Eligibility"
                value={`${active?.minimum_eligible_questions ?? 0} questions`}
              />
              <Stat label="Next finalization" value={previousMonth} />
            </dl>
          </section>
          <div className="grid gap-4 md:grid-cols-3">
            <Summary
              title="Season management"
              text={`${data.seasons.filter((item) => item.status === "planned").length} planned · ${data.seasons.filter((item) => item.status === "closed").length} completed`}
              action={() => choose("seasons")}
            />
            <Summary
              title="Reward history"
              text={`${data.rewardRuns.length} finalized runs`}
              action={() => choose("history")}
            />
            <Summary
              title="Economy rules"
              text={`Active ${data.config.version}`}
              action={() => choose("rules")}
            />
          </div>
        </div>
      )}

      {tab === "seasons" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Season lifecycle</h2>
              <p className="text-sm text-muted-foreground">
                Plan seasons and review past outcomes.
              </p>
            </div>
            {canReset && (
              <button
                onClick={() => setCreating(true)}
                className={`${button} bg-primary text-primary-foreground`}
              >
                <Plus size={16} />
                Plan season
              </button>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.seasons
              .filter((season) => season.status !== "closed")
              .map((season) => (
                <article key={season.id} className={card}>
                  <div className="flex justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Economy {season.economy_version}
                      </p>
                      <h3 className="text-lg font-bold">{season.name}</h3>
                    </div>
                    <span className="h-fit rounded-full bg-muted px-2.5 py-1 text-xs font-bold capitalize">
                      {season.status}
                    </span>
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-4">
                    <Stat
                      label="Opening grant"
                      value={`${season.opening_grant} NP`}
                    />
                    <Stat label="Members" value={season.member_count} />
                    <Stat
                      label="NP supply"
                      value={Number(season.currency_supply).toLocaleString()}
                    />
                    <Stat
                      label={season.status === "closed" ? "Closed" : "Starts"}
                      value={date(season.ends_at ?? season.starts_at)}
                    />
                  </dl>
                  {season.status === "planned" && canReset && (
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setEditing(season)}
                        className={`${button} border`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={async () => {
                          setActivating(season);
                          setImpact(null);
                          setConfirmation("");
                          const result = await request(
                            {
                              action: "preview_activation",
                              seasonId: season.id,
                            },
                            "impact",
                          );
                          if (result) setImpact(result.impact);
                        }}
                        className={`${button} border border-primary/30 text-primary`}
                      >
                        <RotateCcw size={16} />
                        Start
                      </button>
                    </div>
                  )}
                </article>
              ))}
          </div>
        </div>
      )}

      {tab === "rewards" && (
        <div className="space-y-5">
          <div className="space-y-4">
            <details open className={card}>
              <summary className="cursor-pointer text-lg font-bold">
                Monthly rewards
              </summary>
              <p className="text-sm text-muted-foreground">
                Set eligibility and NP prizes for the active season.
              </p>
              <Num
                label="Minimum eligible questions"
                value={activeMinimum}
                set={setActiveMinimum}
              />
              <div className="mt-4">
                <RewardTable
                  title="Monthly NP rewards"
                  value={activeMonthly}
                  set={setActiveMonthly}
                />
              </div>
            </details>
            <details className={card}>
              <summary className="cursor-pointer text-lg font-bold">
                Seasonal rewards
              </summary>
              <p className="text-sm text-muted-foreground">
                Set the final ranking prizes paid when a season closes.
              </p>
              <div className="mt-4">
                <RewardTable
                  title="Seasonal NP rewards"
                  value={activeSeasonal}
                  set={setActiveSeasonal}
                />
              </div>
              {canReset && active && (
                <button
                  disabled={busy === "rules"}
                  onClick={async () => {
                    if (
                      await request(
                        {
                          action: "update_rules",
                          seasonId: active.id,
                          minimumEligibleQuestions: activeMinimum,
                          monthlyRewards: activeMonthly,
                          seasonalRewards: activeSeasonal,
                        },
                        "rules",
                      )
                    )
                      setNotice("Reward rules saved.");
                  }}
                  className={`${button} mt-5 bg-primary text-primary-foreground`}
                >
                  Save reward rules
                </button>
              )}
            </details>
            <details className={card}>
              <summary className="cursor-pointer text-lg font-bold">
                Monthly finalization
              </summary>
              <p className="text-sm text-muted-foreground">
                Preview leaders and exact NP payouts first.
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  type="month"
                  max={previousMonth}
                  value={month}
                  onChange={(event) => {
                    setMonth(event.target.value);
                    setMonthPreview(null);
                  }}
                  className={`${control} flex-1`}
                />
                <button
                  onClick={async () => {
                    const result = await request(
                      { action: "preview_month", month },
                      "month",
                    );
                    if (result) setMonthPreview(result);
                  }}
                  className={`${button} border`}
                >
                  Preview
                </button>
              </div>
              {monthPreview && (
                <div className="mt-4 rounded-xl bg-muted/40 p-4">
                  <dl className="grid grid-cols-3 gap-3">
                    <Stat
                      label="Eligible"
                      value={Number(monthPreview.eligibleCount ?? 0)}
                    />
                    <Stat
                      label="Excluded"
                      value={Number(monthPreview.excludedCount ?? 0)}
                    />
                    <Stat
                      label="Payout"
                      value={`${Number(monthPreview.totalNP ?? 0).toLocaleString()} NP`}
                    />
                  </dl>
                  {Boolean(monthPreview.alreadyFinalized) ? (
                    <p className="mt-4 font-bold text-amber-600">
                      Already finalized.
                    </p>
                  ) : (
                    canReset && (
                      <>
                        <input
                          value={payoutConfirmation}
                          onChange={(event) =>
                            setPayoutConfirmation(event.target.value)
                          }
                          placeholder={`Type FINALIZE ${month}`}
                          className={`${control} mt-4 w-full`}
                        />
                        <button
                          disabled={payoutConfirmation !== `FINALIZE ${month}`}
                          onClick={async () => {
                            if (
                              await request(
                                {
                                  action: "award_month",
                                  month,
                                  confirmation: payoutConfirmation,
                                },
                                "award",
                              )
                            ) {
                              setMonthPreview(null);
                              setPayoutConfirmation("");
                              setNotice("Monthly NP rewards finalized.");
                            }
                          }}
                          className={`${button} mt-3 w-full bg-primary text-primary-foreground`}
                        >
                          Finalize month
                        </button>
                      </>
                    )
                  )}
                </div>
              )}
            </details>
          </div>
        </div>
      )}

      {tab === "rules" && (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <FriendlyRuleGroups
              title="Nexus Points (NP)"
              description="Control spendable points, caps, streaks, games and bounties."
              value={npConfig}
              set={setNPConfig}
              omit={[
                "store",
                "weeklyGoals",
                "modeIds",
                "economyVersion",
                "timezone",
              ]}
            />
            <FriendlyRuleGroups
              title="Experience Points (XP)"
              description="Control progression rewards, clinical ranks and rank-up NP."
              value={xpConfig}
              set={setXPConfig}
              omit={["weeklyGoal", "version"]}
            />
          </div>
          {canReset && (
            <section
              className={`${card} sticky bottom-3 border-primary/25 shadow-lg`}
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <label className="text-sm font-bold">
                  Reason for this change
                  <input
                    value={configReason}
                    onChange={(event) => setConfigReason(event.target.value)}
                    placeholder="Example: Increase the daily practice cap for the new season"
                    className={`${control} mt-2 w-full`}
                  />
                </label>
                <button
                  onClick={async () => {
                    const result = await request(
                      { action: "preview_config", npConfig, xpConfig },
                      "config",
                    );
                    if (result) setConfigPreview(result.changes);
                  }}
                  className={`${button} self-end border border-primary/30 text-primary`}
                >
                  {busy === "config" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Settings2 size={16} />
                  )}
                  Review changes
                </button>
              </div>
              {configPreview.length > 0 && (
                <div className="mt-4 rounded-xl bg-muted/40 p-4">
                  <p className="font-bold">
                    Review {configPreview.length} setting changes
                  </p>
                  <ul className="mt-2 max-h-52 space-y-1 overflow-auto text-xs">
                    {configPreview.map((change) => (
                      <li
                        key={change.path}
                        className="rounded-lg bg-background p-2"
                      >
                        <b>{humanizePath(change.path)}</b>
                        <span className="block text-muted-foreground">
                          {displayValue(change.before)} →{" "}
                          {displayValue(change.after)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input
                      value={configConfirmation}
                      onChange={(event) =>
                        setConfigConfirmation(event.target.value)
                      }
                      placeholder="Type ACTIVATE RULES"
                      className={control}
                    />
                    <button
                      disabled={
                        configConfirmation !== "ACTIVATE RULES" ||
                        configReason.trim().length < 3
                      }
                      onClick={async () => {
                        if (
                          await request(
                            {
                              action: "activate_config",
                              npConfig,
                              xpConfig,
                              reason: configReason,
                              confirmation: configConfirmation,
                            },
                            "activate-config",
                          )
                        ) {
                          setConfigPreview([]);
                          setConfigReason("");
                          setConfigConfirmation("");
                          setNotice("New NP and XP rules are active.");
                        }
                      }}
                      className={`${button} bg-primary text-primary-foreground`}
                    >
                      Activate settings
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {tab === "gifts" && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Select one or more learners, then enter the NP amount and reason.
          </p>
          <div>
            <section className={card}>
              <h3 className="font-bold">1. Select learners</h3>
              <div className="relative mt-3">
                <Search
                  size={16}
                  className="absolute left-3 top-3.5 text-muted-foreground"
                />
                <input
                  value={learnerQuery}
                  onChange={(event) => setLearnerQuery(event.target.value)}
                  placeholder="Search by learner name or index number"
                  className={`${control} w-full pl-10`}
                />
              </div>
              <div className="mt-3 max-h-64 space-y-2 overflow-auto">
                {visibleLearners.map((learner) => (
                  <label
                    key={learner.uid}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-xl border p-3 text-left ${selectedLearnerIds.includes(learner.uid) ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedLearnerIds.includes(learner.uid)}
                        onChange={() => {
                          setSelectedLearnerIds((current) =>
                            current.includes(learner.uid)
                              ? current.filter((id) => id !== learner.uid)
                              : [...current, learner.uid],
                          );
                          setGiftPreview(null);
                        }}
                        aria-label={`Select ${learner.name}`}
                        className="size-4 accent-primary"
                      />
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary">
                        {learner.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <b className="block truncate text-sm">{learner.name}</b>
                        <span className="text-xs text-muted-foreground">
                          {learner.index_number}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs">
                      <b className="block">
                        {learner.balance.toLocaleString()} NP
                      </b>
                      <span className="text-muted-foreground">
                        Current balance
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {selectedLearnerIds.length > 0 && (
                <div className="mt-5 border-t pt-5">
                  <h3 className="font-bold">
                    2. Gift {selectedLearnerIds.length} selected learner
                    {selectedLearnerIds.length === 1 ? "" : "s"}
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Num
                      label="NP amount"
                      value={giftAmount}
                      set={(value) => {
                        setGiftAmount(value);
                        setGiftPreview(null);
                      }}
                    />
                    <Field
                      label="Reason"
                      value={giftReason}
                      set={(value) => {
                        setGiftReason(value);
                        setGiftPreview(null);
                      }}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      disabled={giftAmount < 1 || giftReason.trim().length < 3}
                      onClick={async () => {
                        const result = await request(
                          {
                            action: "validate_gifts",
                            gifts: data.learners
                              .filter((learner) =>
                                selectedLearnerIds.includes(learner.uid),
                              )
                              .map((learner) => ({
                                indexNumber: learner.index_number,
                                amount: giftAmount,
                                reason: giftReason,
                              })),
                          },
                          "gifts",
                        );
                        if (result) setGiftPreview(result);
                      }}
                      className={`${button} border`}
                    >
                      Review gift
                    </button>
                    {canReset && giftPreview && Boolean(giftPreview.valid) && (
                      <button
                        onClick={async () => {
                          if (
                            await request(
                              {
                                action: "gift_np",
                                gifts: data.learners
                                  .filter((learner) =>
                                    selectedLearnerIds.includes(learner.uid),
                                  )
                                  .map((learner) => ({
                                    indexNumber: learner.index_number,
                                    amount: giftAmount,
                                    reason: giftReason,
                                  })),
                              },
                              "send-gifts",
                            )
                          ) {
                            setGiftPreview(null);
                            setGiftReason("");
                            setSelectedLearnerIds([]);
                            setNotice("NP gifts sent and recorded.");
                          }
                        }}
                        className={`${button} bg-primary text-primary-foreground`}
                      >
                        <Gift size={16} />
                        Send{" "}
                        {(
                          giftAmount * selectedLearnerIds.length
                        ).toLocaleString()}{" "}
                        NP
                      </button>
                    )}
                  </div>
                  {giftPreview && <GiftPreview value={giftPreview} />}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <section className={card}>
              <h2 className="font-bold">Reward runs</h2>
              <div className="mt-3 max-h-[32rem] space-y-2 overflow-auto">
                {data.rewardRuns.length ? (
                  data.rewardRuns.map((run) => (
                    <details key={run.id} className="rounded-xl border p-3">
                      <summary className="flex cursor-pointer justify-between gap-3 text-sm">
                        <b className="capitalize">
                          {run.reward_type} · {run.period_key}
                        </b>
                        <b className="text-primary">
                          {Number(run.total_np).toLocaleString()} NP
                        </b>
                      </summary>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {run.eligible_count} eligible · {run.excluded_count}{" "}
                        excluded · {date(run.executed_at)}
                      </p>
                      <ol className="mt-2 space-y-1 text-xs">
                        {run.recipients.map((item) => (
                          <li key={item.userId}>
                            #{item.place} ·{" "}
                            {Number(item.score).toLocaleString()} XP ·{" "}
                            {item.npAmount} NP
                          </li>
                        ))}
                      </ol>
                    </details>
                  ))
                ) : (
                  <Empty text="No finalized rewards yet." />
                )}
              </div>
            </section>
            <section className={card}>
              <h2 className="font-bold">NP gifts</h2>
              <div className="mt-3 max-h-[32rem] space-y-2 overflow-auto">
                {data.gifts.length ? (
                  data.gifts.map((gift) => (
                    <div
                      key={gift.id}
                      className="flex items-start justify-between gap-3 rounded-xl border p-3"
                    >
                      <div className="min-w-0">
                        <b className="block truncate text-sm">
                          {gift.name ?? gift.index_number}
                        </b>
                        <p className="truncate text-xs text-muted-foreground">
                          {gift.index_number} · {gift.reason}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {date(gift.created_at)}
                          {gift.batch_id ? " · Bulk gift" : ""}
                        </p>
                      </div>
                      <b className="shrink-0 text-sm text-emerald-600">
                        +{gift.amount.toLocaleString()} NP
                      </b>
                    </div>
                  ))
                ) : (
                  <Empty text="No NP gifts yet." />
                )}
              </div>
            </section>
          </div>
          <section className={card}>
            <h2 className="font-bold">Completed seasons</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.seasons.filter((season) => season.status === "closed")
                .length ? (
                data.seasons
                  .filter((season) => season.status === "closed")
                  .map((season) => (
                    <div key={season.id} className="rounded-xl border p-3">
                      <div className="flex justify-between gap-3">
                        <b>{season.name}</b>
                        <span className="text-xs text-muted-foreground">
                          {season.economy_version}
                        </span>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-3">
                        <Stat
                          label="Closed"
                          value={date(season.ends_at ?? season.starts_at)}
                        />
                        <Stat
                          label="NP awarded"
                          value={Number(
                            season.currency_earned,
                          ).toLocaleString()}
                        />
                      </dl>
                    </div>
                  ))
              ) : (
                <Empty text="No completed seasons yet." />
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "reports" && (
        <section className={card}>
          <h2 className="text-lg font-bold">Economy report</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Export seasons, reward runs, NP gifts, balances, and economy totals.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Seasons" value={data.seasons.length} />
            <Stat label="Reward runs" value={data.rewardRuns.length} />
            <Stat label="NP gifts" value={data.gifts.length} />
            <Stat label="Learners" value={data.learners.length} />
          </dl>
          <a
            href="/api/admin/economy-seasons?download=1"
            className={`${button} mt-5 bg-primary text-primary-foreground`}
          >
            <Download size={16} />
            Download report
          </a>
        </section>
      )}

      {creating && (
        <Modal title="Plan economy season" close={() => setCreating(false)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Season name" value={name} set={setName} />
            <Field label="Economy version" value={version} set={setVersion} />
            <Num
              label="Opening NP grant"
              value={openingGrant}
              set={setOpeningGrant}
            />
            <Num
              label="Minimum eligible questions"
              value={minimum}
              set={setMinimum}
            />
            <label className="text-xs font-bold sm:col-span-2">
              Start date
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className={`${control} mt-1 w-full`}
              />
            </label>
            <div className="sm:col-span-2">
              <RewardTable
                title="Monthly NP rewards"
                value={monthly}
                set={setMonthly}
              />
            </div>
            <div className="sm:col-span-2">
              <RewardTable
                title="Seasonal NP rewards"
                value={seasonal}
                set={setSeasonal}
              />
            </div>
          </div>
          <button
            disabled={
              busy === "create" || name.trim().length < 3 || !version.trim()
            }
            onClick={async () => {
              if (
                await request(
                  {
                    action: "create",
                    name,
                    economyVersion: version,
                    openingGrant,
                    minimumEligibleQuestions: minimum,
                    monthlyRewards: monthly,
                    seasonalRewards: seasonal,
                    startsAt: startsAt || new Date().toISOString(),
                  },
                  "create",
                )
              ) {
                setCreating(false);
                setNotice("Season planned.");
              }
            }}
            className={`${button} mt-5 w-full bg-primary text-primary-foreground`}
          >
            Create season
          </button>
        </Modal>
      )}
      {editing && (
        <Modal title="Edit planned season" close={() => setEditing(null)}>
          <div className="grid gap-3">
            <Field
              label="Season name"
              value={editing.name}
              set={(value) => setEditing({ ...editing, name: value })}
            />
            <Num
              label="Opening NP grant"
              value={editing.opening_grant}
              set={(value) => setEditing({ ...editing, opening_grant: value })}
            />
            <label className="text-xs font-bold">
              Start date
              <input
                type="datetime-local"
                value={new Date(editing.starts_at).toISOString().slice(0, 16)}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    starts_at: new Date(event.target.value).toISOString(),
                  })
                }
                className={`${control} mt-1 w-full`}
              />
            </label>
          </div>
          <button
            disabled={editing.name.trim().length < 3 || busy === "edit"}
            onClick={async () => {
              if (
                await request(
                  {
                    action: "edit_season",
                    seasonId: editing.id,
                    name: editing.name,
                    openingGrant: editing.opening_grant,
                    startsAt: editing.starts_at,
                  },
                  "edit",
                )
              ) {
                setEditing(null);
                setNotice("Planned season updated.");
              }
            }}
            className={`${button} mt-5 w-full bg-primary text-primary-foreground`}
          >
            Save season
          </button>
        </Modal>
      )}
      {activating && (
        <Modal
          title={`Start ${activating.name}`}
          close={() => setActivating(null)}
        >
          <p className="text-sm text-muted-foreground">
            {
              "Seasonal rewards will finalize. NP, purchases, cosmetics, and lifetime XP remain."
            }
          </p>
          {impact ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-4">
              <Stat label="Learners" value={impact.affectedLearners} />
              <Stat
                label="NP carried"
                value={impact.carriedNP?.toLocaleString()}
              />
              <Stat
                label="Opening NP total"
                value={impact.openingGrantTotal?.toLocaleString()}
              />
              <Stat
                label="Per learner"
                value={`${impact.openingGrantPerLearner} NP`}
              />
            </dl>
          ) : (
            <p className="mt-4">Loading impact preview…</p>
          )}
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={`Type START ${activating.name.toUpperCase()}`}
            className={`${control} mt-4 w-full`}
          />
          <button
            disabled={
              !impact ||
              confirmation !== `START ${activating.name.toUpperCase()}`
            }
            onClick={async () => {
              if (
                await request(
                  { action: "activate", seasonId: activating.id, confirmation },
                  "activate",
                )
              ) {
                setActivating(null);
                setNotice("New season started; NP balances were preserved.");
              }
            }}
            className={`${button} mt-3 w-full bg-destructive text-destructive-foreground`}
          >
            Start season
          </button>
        </Modal>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-bold tabular-nums">{value ?? "—"}</dd>
    </div>
  );
}
function Summary({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: () => void;
}) {
  return (
    <button
      onClick={action}
      className={`${card} text-left hover:border-primary/30`}
    >
      <b>{title}</b>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      <span className="mt-4 block text-xs font-bold text-primary">Open →</span>
    </button>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
      {text}
    </p>
  );
}
function date(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/55 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="my-6 w-full max-w-2xl rounded-3xl border bg-card p-6 shadow-2xl"
      >
        <div className="flex justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={close} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
function Field({
  label,
  value,
  set,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
}) {
  return (
    <label className="text-xs font-bold">
      {label}
      <input
        value={value}
        onChange={(event) => set(event.target.value)}
        className={`${control} mt-1 w-full`}
      />
    </label>
  );
}
function Num({
  label,
  value,
  set,
}: {
  label: string;
  value: number;
  set: (value: number) => void;
}) {
  return (
    <label className="text-xs font-bold">
      {label}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => set(Number(event.target.value))}
        className={`${control} mt-1 w-full`}
      />
    </label>
  );
}
function RewardTable({
  title,
  value,
  set,
}: {
  title: string;
  value: number[];
  set: (value: number[]) => void;
}) {
  return (
    <div>
      <div className="flex justify-between">
        <b className="text-xs">{title}</b>
        <button
          type="button"
          onClick={() => set([...value, 0])}
          className="text-xs font-bold text-primary"
        >
          + Add place
        </button>
      </div>
      <div className="mt-2 grid gap-2">
        {value.map((amount, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-16 text-xs">Place {index + 1}</span>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(event) =>
                set(
                  value.map((item, i) =>
                    i === index ? Number(event.target.value) : item,
                  ),
                )
              }
              className={`${control} flex-1`}
            />
            <span className="text-xs font-bold">NP</span>
            {value.length > 1 && (
              <button
                type="button"
                onClick={() => set(value.filter((_, i) => i !== index))}
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
const ruleHelp: Record<string, string> = {
  enabledEarningModes: "Turn NP earning on or off for each activity.",
  dailyLogin: "Set the login reward and streak milestones.",
  questionRewards: "Set Trial and Tutor rewards and their daily cap.",
  examRewards: "Set exam completion, accuracy and discipline rewards.",
  gameRewards: "Set solo, Group Study and multiplayer rewards.",
  familyDailyCaps: "Limit how much NP each activity family can earn per day.",
  repeatableDailyCeiling:
    "Set the maximum repeatable NP a learner can earn daily.",
  bounties: "Set each daily bounty target and NP reward.",
  antiFarming: "Control repeat rewards and activity safety limits.",
  solo: "Set XP for solo games.",
  multiplayer: "Set XP for multiplayer games.",
  groupStudy: "Set XP for Group Study.",
  clinicalRanks: "Set XP thresholds and rank-up NP rewards.",
  bounty: "Set the XP awarded for each bounty.",
};
const fixedRuleKeys = new Set(["id", "type", "mode", "name"]);
function labelFor(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase())
    .replace(/\bNp\b/g, "NP")
    .replace(/\bXp\b/g, "XP");
}
function humanizePath(path: string) {
  return path
    .split(".")
    .filter((part) => !/^\d+$/.test(part))
    .map(labelFor)
    .join(" › ");
}
function displayValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (value === null) return "None";
  return String(value);
}
function FriendlyRuleGroups({
  title,
  description,
  value,
  set,
  omit,
}: {
  title: string;
  description: string;
  value: Record<string, unknown>;
  set: (value: Record<string, unknown>) => void;
  omit: string[];
}) {
  return (
    <section className={card}>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 space-y-3">
        {Object.entries(value)
          .filter(([key]) => !omit.includes(key))
          .map(([key, item], index) => (
            <details
              key={key}
              open={index === 0}
              className="rounded-xl border bg-background"
            >
              <summary className="cursor-pointer list-none p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <b className="text-sm">{labelFor(key)}</b>
                    <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                      {ruleHelp[key] ??
                        "Adjust the values used for future economy activity."}
                    </p>
                  </div>
                  <Settings2
                    size={16}
                    className="shrink-0 text-muted-foreground"
                  />
                </div>
              </summary>
              <div className="border-t p-4">
                <ConfigFields
                  value={item}
                  path={key}
                  set={(next) => set({ ...value, [key]: next })}
                />
              </div>
            </details>
          ))}
      </div>
    </section>
  );
}
function ConfigFields({
  value,
  path,
  set,
}: {
  value: unknown;
  path: string;
  set: (value: unknown) => void;
}): ReactNode {
  if (typeof value === "boolean")
    return (
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => set(!value)}
        className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-3 text-sm ${value ? "border-emerald-500/40 bg-emerald-500/5" : "bg-muted/30"}`}
      >
        <span>{value ? "Enabled" : "Disabled"}</span>
        <span
          className={`relative h-6 w-11 rounded-full ${value ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
        >
          <span
            className={`absolute top-1 size-4 rounded-full bg-white transition-transform ${value ? "left-6" : "left-1"}`}
          />
        </span>
      </button>
    );
  if (typeof value === "number")
    return (
      <input
        aria-label={humanizePath(path)}
        type="number"
        min={0}
        step={Number.isInteger(value) ? 1 : 0.05}
        value={value}
        onChange={(event) => set(Number(event.target.value))}
        className={`${control} w-full tabular-nums`}
      />
    );
  if (typeof value === "string") {
    const key = path.split(".").at(-1) ?? "";
    return fixedRuleKeys.has(key) ? (
      <div className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {labelFor(value)}
      </div>
    ) : (
      <input
        aria-label={humanizePath(path)}
        value={value}
        onChange={(event) => set(event.target.value)}
        className={`${control} w-full`}
      />
    );
  }
  if (value === null)
    return (
      <div className="rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        No limit
      </div>
    );
  if (Array.isArray(value))
    return (
      <div className="space-y-3">
        {value.map((item, index) => (
          <div
            key={
              typeof item === "object" && item && "id" in item
                ? String((item as { id: unknown }).id)
                : index
            }
            className="rounded-xl border bg-card p-3"
          >
            <p className="mb-3 text-xs font-bold text-muted-foreground">
              {typeof item === "object" && item && "name" in item
                ? String((item as { name: unknown }).name)
                : typeof item === "object" && item && "id" in item
                  ? labelFor(String((item as { id: unknown }).id))
                  : `Level ${index + 1}`}
            </p>
            <ConfigFields
              value={item}
              path={`${path}.${index}`}
              set={(next) =>
                set(
                  value.map((entry, itemIndex) =>
                    itemIndex === index ? next : entry,
                  ),
                )
              }
            />
          </div>
        ))}
      </div>
    );
  if (value && typeof value === "object")
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(value).map(([key, item]) => (
          <label
            key={key}
            className={
              Array.isArray(item) || (typeof item === "object" && item !== null)
                ? "sm:col-span-2"
                : ""
            }
          >
            <span className="mb-1.5 block text-xs font-bold">
              {labelFor(key)}
            </span>
            <ConfigFields
              value={item}
              path={`${path}.${key}`}
              set={(next) =>
                set({ ...(value as Record<string, unknown>), [key]: next })
              }
            />
          </label>
        ))}
      </div>
    );
  return null;
}
function GiftPreview({ value }: { value: Record<string, unknown> }) {
  const errors = Array.isArray(value.errors)
    ? (value.errors as Array<{ row: number; error: string }>)
    : [];
  return (
    <div
      className={`mt-4 rounded-xl p-4 ${value.valid ? "bg-emerald-500/10" : "bg-destructive/10"}`}
    >
      <b>
        {value.valid
          ? `Ready to send ${Number(value.totalNP ?? 0).toLocaleString()} NP`
          : "Correct these rows"}
      </b>
      {errors.map((item) => (
        <p
          key={`${item.row}-${item.error}`}
          className="text-xs text-destructive"
        >
          Row {item.row}: {item.error}
        </p>
      ))}
    </div>
  );
}
