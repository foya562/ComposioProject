import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

import {
  Search,
  Sparkles,
  Clock3,
  ArrowUpRight,
  LayoutGrid,
  Code2,
  CalendarDays,
  MessageSquare,
  BookOpen,
  Database,
  Zap,
  X,
  Share2,
} from "lucide-react";

function getAppIcon(category = "") {
  const value = category.toLowerCase();

  if (value.includes("productivity")) return CalendarDays;
  if (value.includes("developer")) return Code2;
  if (value.includes("communication")) return MessageSquare;
  if (value.includes("crm")) return Database;

  return BookOpen;
}

function getGuideDescription(guide) {
  const content = guide?.guide_content;

  if (
    content &&
    typeof content === "object" &&
    !Array.isArray(content) &&
    typeof content.description === "string"
  ) {
    return content.description;
  }

  return `Explore OAuth setup requirements for ${
    guide?.app_name || "this app"
  }.`;
}

function getManagedOAuth(content) {
  if (!content || typeof content !== "object") {
    return null;
  }

  return content.managedOAuth || null;
}

function formatApp(guide) {
  const content =
    guide.guide_content &&
    typeof guide.guide_content === "object" &&
    !Array.isArray(guide.guide_content)
      ? guide.guide_content
      : {};

  return {
    id: guide.id,
    name: guide.app_name || "Unknown app",
    domain: guide.app_domain || "",
    category: guide.category || "Other",
    difficulty: guide.difficulty || "Unknown",
    estimatedMinutes: guide.estimated_minutes ?? null,
    description: getGuideDescription(guide),
    guideContent: content,
    sources: Array.isArray(guide.sources)
      ? guide.sources
      : Array.isArray(content.sources)
      ? content.sources
      : [],
    steps: Array.isArray(content.steps) ? content.steps : [],
    approvals: Array.isArray(content.approvals) ? content.approvals : [],
    blockers: Array.isArray(content.blockers) ? content.blockers : [],
    caveats: Array.isArray(content.caveats) ? content.caveats : [],
    managedOAuth: getManagedOAuth(content),
  };
}

export default function App() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All apps");

  const [selectedApp, setSelectedApp] = useState(null);
  const [customApp, setCustomApp] = useState("");
  const [apps, setApps] = useState([]);

  const [loadingGuides, setLoadingGuides] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const [copyMessage, setCopyMessage] = useState("");

  // Open a guide and put its ID in the URL.
  // pushState lets the browser Back button close the guide.
  function openGuide(app) {
    setSelectedApp(app);
    setCopyMessage("");

    if (app?.id == null) return;

    const url = new URL(window.location.href);
    url.searchParams.set("guide", String(app.id));

    if (url.href !== window.location.href) {
      window.history.pushState({ guideId: String(app.id) }, "", url);
    }
  }

  // Close the guide and remove its ID from the URL.
  function closeGuide() {
    setSelectedApp(null);
    setCopyMessage("");

    const url = new URL(window.location.href);

    if (url.searchParams.has("guide")) {
      url.searchParams.delete("guide");

      window.history.replaceState(window.history.state, "", url);
    }
  }

  // Copy a URL that opens this specific guide.
  async function shareGuide() {
    if (!selectedApp?.id) {
      setCopyMessage("This guide does not have a shareable ID yet.");
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("guide", String(selectedApp.id));

    try {
      await navigator.clipboard.writeText(url.href);
      setCopyMessage("Guide link copied!");
    } catch (error) {
      setCopyMessage(
        "Could not copy automatically. Copy the URL from your browser."
      );
    }
  }

  // Load saved guides from Supabase.
  useEffect(() => {
    let cancelled = false;

    async function loadGuides() {
      setLoadingGuides(true);
      setLoadError("");

      const { data, error } = await supabase
        .from("guides")
        .select(
          "id, app_name, app_domain, category, difficulty, estimated_minutes, guide_content, sources, created_at"
        )
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Could not load guides:", error);
        setLoadError(
          "Could not load guides. Check your Supabase connection and table permissions."
        );
        setApps([]);
      } else {
        setApps((data || []).map(formatApp));
      }

      setLoadingGuides(false);
    }

    loadGuides();

    return () => {
      cancelled = true;
    };
  }, []);

  // Open a guide automatically when the page URL contains ?guide=ID.
  // Also respond to browser Back and Forward navigation.
  useEffect(() => {
    if (loadingGuides) return;

    function syncGuideFromUrl() {
      const url = new URL(window.location.href);
      const guideId = url.searchParams.get("guide");

      if (!guideId) {
        setSelectedApp(null);
        return;
      }

      const matchingGuide = apps.find((app) => String(app.id) === guideId);

      if (matchingGuide) {
        setSelectedApp(matchingGuide);
      } else {
        setSelectedApp(null);
        console.warn(`No saved guide was found for guide ID "${guideId}".`);
      }
    }

    syncGuideFromUrl();

    window.addEventListener("popstate", syncGuideFromUrl);

    return () => {
      window.removeEventListener("popstate", syncGuideFromUrl);
    };
  }, [apps, loadingGuides]);

  // Build category filters from the guides currently loaded.
  const categories = useMemo(() => {
    const uniqueCategories = [
      ...new Set(apps.map((app) => app.category).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));

    return ["All apps", ...uniqueCategories];
  }, [apps]);

  // Apply the search box and selected category.
  const filteredApps = useMemo(() => {
    const query = search.trim().toLowerCase();

    return apps.filter((app) => {
      const matchesCategory =
        category === "All apps" || app.category === category;

      const matchesSearch =
        !query ||
        app.name.toLowerCase().includes(query) ||
        app.domain.toLowerCase().includes(query) ||
        app.description.toLowerCase().includes(query) ||
        app.category.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [apps, search, category]);

  // Submit an app name or website.
  // Reuse a saved guide when one already matches.
  // Otherwise ask the Supabase Edge Function to generate one.
  async function submitCustomApp(event) {
    event?.preventDefault();

    const submittedValue = customApp.trim();

    if (!submittedValue || generating) return;

    setGenerating(true);
    setGenerateError("");

    try {
      let appName = submittedValue;
      let appDomain = "";

      // Recognize a URL if the user submitted one.
      if (submittedValue.includes(".") && !submittedValue.includes(" ")) {
        try {
          const normalizedUrl = submittedValue.match(/^https?:\/\//i)
            ? submittedValue
            : `https://${submittedValue}`;

          const parsedUrl = new URL(normalizedUrl);

          appDomain = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();

          appName = appDomain
            .split(".")[0]
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (character) => character.toUpperCase());
        } catch {
          appName = submittedValue;
        }
      }

      // Look for an existing guide before generating another one.
      const { data: existingGuides, error: lookupError } = await supabase
        .from("guides")
        .select(
          "id, app_name, app_domain, category, difficulty, estimated_minutes, guide_content, sources, created_at"
        )
        .limit(100);

      if (lookupError) {
        console.error("Guide lookup failed:", lookupError);
      }

      const normalizedName = appName.toLowerCase().trim();
      const normalizedDomain = appDomain.toLowerCase().trim();

      const existingGuide = (existingGuides || []).find((guide) => {
        const savedName = (guide.app_name || "").toLowerCase().trim();

        const savedDomain = (guide.app_domain || "").toLowerCase().trim();

        return (
          savedName === normalizedName ||
          (normalizedDomain && savedDomain === normalizedDomain)
        );
      });

      if (existingGuide) {
        const formattedGuide = formatApp(existingGuide);

        setApps((currentApps) => {
          const alreadyLoaded = currentApps.some(
            (app) => String(app.id) === String(formattedGuide.id)
          );

          return alreadyLoaded ? currentApps : [formattedGuide, ...currentApps];
        });

        setCustomApp("");
        openGuide(formattedGuide);
        setGenerating(false);
        return;
      }

      // Generate a new guide through the server-side Edge Function.
      const { data, error } = await supabase.functions.invoke(
        "bright-responder",
        {
          body: {
            appName,
            appDomain,
          },
        }
      );

      if (error) {
        console.error("Guide generation failed:", error);
        throw new Error(
          error.message || "Guide generation failed. Please try again later."
        );
      }

      if (!data?.success || !data?.guide) {
        throw new Error(
          data?.message ||
            data?.error ||
            "The guide could not be generated. Please try again."
        );
      }

      const formattedGuide = formatApp(data.guide);

      setApps((currentApps) => [
        formattedGuide,
        ...currentApps.filter(
          (app) => String(app.id) !== String(formattedGuide.id)
        ),
      ]);

      setCustomApp("");
      openGuide(formattedGuide);
    } catch (error) {
      console.error("Could not submit custom app:", error);

      setGenerateError(
        error?.message || "Something went wrong while creating the guide."
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080b12] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0b0f18]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <button
            type="button"
            onClick={() => {
              closeGuide();
              setSearch("");
              setCategory("All apps");
            }}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
              <Zap size={23} />
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-tight">
                OAuth Launchpad
              </h1>
              <p className="text-xs text-slate-400">OAuth setup guide finder</p>
            </div>
          </button>

          <div className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-slate-400 sm:flex">
            <Database size={14} />
            <span>Powered by Supabase</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        {/* Hero */}
        <section className="mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-medium text-violet-300">
            <Sparkles size={14} />
            OAuth setup, simplified
          </div>

          <h2 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            Connect your tools.
            <span className="block text-violet-300">Know what comes next.</span>
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            Find OAuth setup instructions, understand approval requirements,
            estimate the effort, and discover when a human needs to step in.
          </p>
        </section>

        {/* Custom app generator */}
        <section className="mb-10 rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/10 to-transparent p-5 sm:p-7">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-xl bg-violet-400/15 p-3 text-violet-300">
              <Sparkles size={22} />
            </div>

            <div>
              <h3 className="text-lg font-semibold">
                Looking for another app?
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                Enter an app name or website to generate an OAuth setup guide.
              </p>
            </div>
          </div>

          <form
            onSubmit={submitCustomApp}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                type="text"
                value={customApp}
                onChange={(event) => {
                  setCustomApp(event.target.value);
                  setGenerateError("");
                }}
                placeholder="e.g. Linear or https://linear.app"
                className="w-full rounded-xl border border-white/10 bg-[#0a0e17] py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-400/60"
              />
            </div>

            <button
              type="submit"
              disabled={!customApp.trim() || generating}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3.5 text-sm font-semibold transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={17} />
                  Find guide
                </>
              )}
            </button>
          </form>

          {generateError && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
            >
              {generateError}
            </div>
          )}

          <p className="mt-3 text-xs leading-5 text-slate-500">
            Generated guides may contain unverified details. Check the linked
            provider documentation before configuring credentials or
            permissions.
          </p>
        </section>

        {/* Search and filters */}
        <section className="mb-6">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h3 className="text-xl font-semibold">Explore OAuth guides</h3>
              <p className="mt-1 text-sm text-slate-400">
                Browse saved guides or search for an integration.
              </p>
            </div>

            <div className="text-sm text-slate-500">
              {filteredApps.length}{" "}
              {filteredApps.length === 1 ? "guide" : "guides"}
            </div>
          </div>

          <div className="relative mb-4">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by app, domain, or category..."
              className="w-full rounded-xl border border-white/10 bg-[#0d111b] py-3.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-600 focus:border-violet-400/50"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full border px-3.5 py-2 text-xs font-medium transition ${
                  category === item
                    ? "border-violet-400/40 bg-violet-400/15 text-violet-200"
                    : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {/* Loading and error states */}
        {loadingGuides && (
          <div className="flex items-center justify-center gap-3 py-20 text-sm text-slate-400">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-violet-400" />
            Loading saved guides...
          </div>
        )}

        {!loadingGuides && loadError && (
          <div
            role="alert"
            className="rounded-2xl border border-red-400/20 bg-red-400/10 p-5 text-sm text-red-300"
          >
            {loadError}
          </div>
        )}

        {/* Guide cards */}
        {!loadingGuides && !loadError && filteredApps.length > 0 && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredApps.map((app) => {
              const AppIcon = getAppIcon(app.category);

              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => openGuide(app)}
                  className="group flex min-h-64 flex-col rounded-2xl border border-white/10 bg-[#0d111b] p-5 text-left transition hover:-translate-y-0.5 hover:border-violet-400/30 hover:bg-[#111624]"
                >
                  <div className="mb-5 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-violet-300">
                      <AppIcon size={22} />
                    </div>

                    <ArrowUpRight
                      size={18}
                      className="text-slate-600 transition group-hover:text-violet-300"
                    />
                  </div>

                  <h4 className="text-base font-semibold">{app.name}</h4>

                  {app.domain && (
                    <p className="mt-1 text-xs text-slate-500">{app.domain}</p>
                  )}

                  <p className="mt-3 flex-1 text-sm leading-6 text-slate-400">
                    {app.description}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-300">
                      {app.category}
                    </span>

                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-400">
                      {app.difficulty}
                    </span>

                    {app.estimatedMinutes != null && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-400">
                        <Clock3 size={12} />
                        {app.estimatedMinutes} min
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </section>
        )}

        {!loadingGuides && !loadError && filteredApps.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 px-5 py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400">
              <LayoutGrid size={22} />
            </div>

            <h4 className="font-semibold">No guides found</h4>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              Try another search or enter an app name above to request a new
              guide.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("All apps");
              }}
              className="mt-5 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
            >
              Clear filters
            </button>
          </div>
        )}
      </main>

      {/* Guide detail modal */}
      {selectedApp && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeGuide();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
            className="my-auto max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0d111b] shadow-2xl sm:rounded-2xl"
          >
            {/* Modal header */}
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0d111b]/95 p-5 backdrop-blur sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-violet-300">
                    {(() => {
                      const AppIcon = getAppIcon(selectedApp.category);
                      return <AppIcon size={22} />;
                    })()}
                  </div>

                  <div>
                    <h2
                      id="guide-title"
                      className="text-xl font-bold sm:text-2xl"
                    >
                      {selectedApp.name}
                    </h2>

                    {selectedApp.domain && (
                      <p className="mt-1 text-sm text-slate-400">
                        {selectedApp.domain}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-300">
                        {selectedApp.category}
                      </span>

                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-300">
                        {selectedApp.difficulty}
                      </span>

                      {selectedApp.estimatedMinutes != null && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-400">
                          <Clock3 size={12} />
                          {selectedApp.estimatedMinutes} min estimated
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeGuide}
                  aria-label="Close guide"
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={shareGuide}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold transition hover:bg-violet-400"
                >
                  <Share2 size={16} />
                  Share guide
                </button>

                {copyMessage && (
                  <p role="status" className="text-xs text-violet-300">
                    {copyMessage}
                  </p>
                )}
              </div>
            </div>

            {/* Modal content */}
            <div className="space-y-8 p-5 sm:p-6">
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                  <BookOpen size={18} className="text-violet-300" />
                  Overview
                </h3>

                <p className="text-sm leading-7 text-slate-300">
                  {selectedApp.description}
                </p>

                {selectedApp.caveats.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                    <h4 className="text-sm font-semibold text-amber-200">
                      Important caveats
                    </h4>

                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
                      {selectedApp.caveats.map((caveat, index) => (
                        <li key={index}>
                          {typeof caveat === "string"
                            ? caveat
                            : caveat?.description ||
                              caveat?.message ||
                              JSON.stringify(caveat)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                  <Zap size={18} className="text-violet-300" />
                  Setup steps
                </h3>

                {selectedApp.steps.length > 0 ? (
                  <ol className="space-y-4">
                    {selectedApp.steps.map((step, index) => {
                      const title =
                        typeof step === "string"
                          ? step
                          : step?.title || step?.name || `Step ${index + 1}`;

                      const description =
                        typeof step === "string"
                          ? ""
                          : step?.description ||
                            step?.details ||
                            step?.instructions ||
                            "";

                      const humanRequired =
                        typeof step === "object" &&
                        (step?.humanRequired === true ||
                          step?.human_required === true);

                      return (
                        <li
                          key={index}
                          className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-400/10 text-sm font-semibold text-violet-300">
                            {index + 1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-white">
                              {title}
                            </h4>

                            {description && (
                              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-400">
                                {description}
                              </p>
                            )}

                            {humanRequired && (
                              <p className="mt-3 text-xs font-medium text-amber-300">
                                Human action required
                              </p>
                            )}

                            {typeof step === "object" && step?.url && (
                              <a
                                href={step.url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex items-center gap-1 text-sm text-violet-300 hover:text-violet-200"
                              >
                                Open resource
                                <ArrowUpRight size={14} />
                              </a>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="rounded-xl border border-white/10 p-4 text-sm leading-6 text-slate-400">
                    No setup steps are available for this guide yet. Check the
                    provider's official documentation in the sources below.
                  </p>
                )}
              </section>

              {selectedApp.blockers.length > 0 && (
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                    <Zap size={18} className="text-amber-300" />
                    Potential blockers
                  </h3>

                  <ul className="space-y-3">
                    {selectedApp.blockers.map((blocker, index) => (
                      <li
                        key={index}
                        className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-4 text-sm leading-6 text-slate-300"
                      >
                        {typeof blocker === "string"
                          ? blocker
                          : blocker?.description ||
                            blocker?.message ||
                            blocker?.title ||
                            JSON.stringify(blocker)}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {selectedApp.approvals.length > 0 && (
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                    <CalendarDays size={18} className="text-violet-300" />
                    Approvals and review
                  </h3>

                  <div className="space-y-3">
                    {selectedApp.approvals.map((approval, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-white/10 p-4"
                      >
                        <h4 className="text-sm font-semibold">
                          {typeof approval === "string"
                            ? approval
                            : approval?.title ||
                              approval?.name ||
                              `Approval ${index + 1}`}
                        </h4>

                        {typeof approval === "object" &&
                          (approval?.description || approval?.details) && (
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {approval.description || approval.details}
                            </p>
                          )}

                        {typeof approval === "object" &&
                          approval?.estimated_wait && (
                            <p className="mt-2 text-xs text-slate-500">
                              Estimated wait: {approval.estimated_wait}
                            </p>
                          )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {selectedApp.managedOAuth && (
                <section>
                  <h3 className="mb-3 text-base font-semibold">
                    Managed OAuth option
                  </h3>

                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                    {typeof selectedApp.managedOAuth === "string" ? (
                      <p className="text-sm leading-6 text-slate-300">
                        {selectedApp.managedOAuth}
                      </p>
                    ) : (
                      <>
                        {selectedApp.managedOAuth.description && (
                          <p className="text-sm leading-6 text-slate-300">
                            {selectedApp.managedOAuth.description}
                          </p>
                        )}

                        {selectedApp.managedOAuth.url && (
                          <a
                            href={selectedApp.managedOAuth.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-1 text-sm text-emerald-300 hover:text-emerald-200"
                          >
                            Learn more
                            <ArrowUpRight size={14} />
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </section>
              )}

              <section>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                  <BookOpen size={18} className="text-violet-300" />
                  Sources and verification
                </h3>

                <p className="mb-4 text-sm leading-6 text-slate-400">
                  AI-generated guidance can be incomplete or outdated. Confirm
                  provider-specific details using official documentation before
                  configuring OAuth credentials or permissions.
                </p>

                {selectedApp.sources.length > 0 ? (
                  <ul className="space-y-3">
                    {selectedApp.sources.map((source, index) => {
                      const title =
                        typeof source === "string"
                          ? source
                          : source?.title ||
                            source?.name ||
                            source?.url ||
                            `Source ${index + 1}`;

                      const url =
                        typeof source === "object"
                          ? source?.url || source?.href || ""
                          : "";

                      const needsVerification =
                        typeof source === "object" &&
                        (source?.needs_verification === true ||
                          source?.needsVerification === true);

                      return (
                        <li
                          key={index}
                          className="rounded-xl border border-white/10 p-4"
                        >
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 break-all text-sm text-violet-300 hover:text-violet-200"
                            >
                              {title}
                              <ArrowUpRight size={14} className="shrink-0" />
                            </a>
                          ) : (
                            <p className="text-sm text-slate-300">{title}</p>
                          )}

                          {typeof source === "object" &&
                            source?.description && (
                              <p className="mt-2 text-sm leading-6 text-slate-400">
                                {source.description}
                              </p>
                            )}

                          {needsVerification && (
                            <p className="mt-2 text-xs text-amber-300">
                              Needs verification
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm leading-6 text-slate-400">
                    No source links were saved with this guide. Search the
                    provider's official OAuth documentation before proceeding.
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-4">
                <h3 className="text-sm font-semibold text-violet-200">
                  What to do next
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Start with the first setup step and verify each requirement
                  against the linked documentation. A developer or account
                  administrator may need to create credentials, grant consent,
                  or submit the integration for review.
                </p>

                <button
                  type="button"
                  onClick={shareGuide}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-violet-400/30 px-3 py-2 text-sm text-violet-200 transition hover:bg-violet-400/10"
                >
                  <Share2 size={15} />
                  Share this guide
                </button>
              </section>
            </div>
          </section>
        </div>
      )}

      <footer className="border-t border-white/10 px-5 py-6 text-center text-xs leading-6 text-slate-500">
        OAuth Launchpad · Verify provider requirements before using generated
        guidance.
      </footer>
    </div>
  );
}
