
"use client";

import { useEffect, useMemo, useState } from "react";

type SDSDocument = {
  id: number;
  chemical: number;
  title: string;
  next_review_date: string | null;
  review_status: "current" | "due_soon" | "overdue" | "unknown";
};

type Chemical = {
  id: number;
  name: string;
  manufacturer: string;
  location: string;
  sds_documents: SDSDocument[];
};

const API_URL = "http://127.0.0.1:8001/api";

const statusLabels: Record<SDSDocument["review_status"], string> = {
  current: "Current",
  due_soon: "Due soon",
  overdue: "Overdue",
  unknown: "Unknown",
};

export default function Home() {
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [documents, setDocuments] = useState<SDSDocument[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [chemicalResponse, documentResponse] = await Promise.all([
          fetch(`${API_URL}/chemicals/`, { signal: controller.signal }),
          fetch(`${API_URL}/sds-documents/`, { signal: controller.signal }),
        ]);

        if (!chemicalResponse.ok || !documentResponse.ok) {
          throw new Error("The API returned an unsuccessful response.");
        }

        const [chemicalData, documentData] = await Promise.all([
          chemicalResponse.json(),
          documentResponse.json(),
        ]);

        setChemicals(chemicalData);
        setDocuments(documentData);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(
            "Couldn't load SafeSheets data. Check that the Django API is running."
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadData();
    return () => controller.abort();
  }, []);

  const filteredChemicals = useMemo(() => {
    return chemicals.filter((chemical) => {
      const matchesSearch = [
        chemical.name,
        chemical.manufacturer,
        chemical.location,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const chemicalDocuments = documents.filter(
        (document) => document.chemical === chemical.id
      );

      const matchesFilter =
        filter === "all" ||
        chemicalDocuments.some((document) => document.review_status === filter);

      return matchesSearch && matchesFilter;
    });
  }, [chemicals, documents, search, filter]);

  const count = (status: SDSDocument["review_status"]) =>
    documents.filter((document) => document.review_status === status).length;

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <a className="brand" href="#">
          <span className="brand-mark">S</span>
          <span>SafeSheets</span>
        </a>

        <p className="nav-heading">WORKSPACE</p>
        <a className="nav-link active" href="#overview">▦ &nbsp; Overview</a>
        <a className="nav-link" href="#chemicals">◇ &nbsp; Chemicals</a>
        <a className="nav-link" href="#documents">▤ &nbsp; SDS documents</a>

        <div className="sidebar-bottom">
          <span className="connection-dot" />
          Django API
          <span className="connection-label">Local</span>
        </div>
      </aside>

      <section className="main-content" id="overview">
        <header className="topbar">
          <div>
            <p className="eyebrow">SAFETY MANAGEMENT</p>
            <h1>Overview</h1>
          </div>
          <div className="profile">
            <span className="avatar">S</span>
            <span>SafeSheets workspace</span>
          </div>
        </header>

        <section className="welcome">
          <div>
            <p className="eyebrow light">YOUR SAFETY WORKSPACE</p>
            <h2>Stay ahead of every review.</h2>
            <p>Track chemical records and keep safety documentation organized.</p>
          </div>
          <div className="welcome-symbol">✓</div>
        </section>

        <div className="section-heading">
          <div>
            <h2>Document overview</h2>
            <p>Review status across your registered SDS documents.</p>
          </div>
          <span className="live-badge">
            <span className="connection-dot" /> Live data
          </span>
        </div>

        {loading ? (
          <p className="notice">Loading your safety records…</p>
        ) : error ? (
          <div className="notice error" role="alert">{error}</div>
        ) : (
          <>
            <section className="stats-grid">
              <article className="stat-card">
                <span className="stat-icon neutral">◇</span>
                <p>Total chemicals</p>
                <strong>{chemicals.length}</strong>
                <span className="stat-foot">Registered records</span>
              </article>
              <article className="stat-card">
                <span className="stat-icon neutral">▤</span>
                <p>SDS documents</p>
                <strong>{documents.length}</strong>
                <span className="stat-foot">Document records</span>
              </article>
              <article className="stat-card">
                <span className="stat-icon danger">!</span>
                <p>Overdue</p>
                <strong>{count("overdue")}</strong>
                <span className="stat-foot">Past review date</span>
              </article>
              <article className="stat-card">
                <span className="stat-icon warning">◷</span>
                <p>Due soon</p>
                <strong>{count("due_soon")}</strong>
                <span className="stat-foot">Within 30 days</span>
              </article>
            </section>

            <section className="records-section" id="chemicals">
              <div className="section-heading records-heading">
                <div>
                  <h2>Chemical inventory</h2>
                  <p>Search records and filter by document review status.</p>
                </div>
                <span className="record-count">
                  {filteredChemicals.length} records
                </span>
              </div>

              <div className="toolbar">
                <label className="search-box">
                  <span>⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search chemicals, manufacturers, locations…"
                    aria-label="Search chemicals"
                  />
                </label>

                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  aria-label="Filter chemicals by SDS review status"
                >
                  <option value="all">All statuses</option>
                  <option value="overdue">Overdue</option>
                  <option value="due_soon">Due soon</option>
                  <option value="current">Current</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Chemical</th>
                      <th>Manufacturer</th>
                      <th>Location</th>
                      <th>SDS documents</th>
                      <th>Review status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredChemicals.map((chemical) => {
                      const related = documents.filter(
                        (document) => document.chemical === chemical.id
                      );
                      const statuses = related.map((document) => document.review_status);
                      const worstStatus = (
                        ["overdue", "due_soon", "unknown", "current"] as const
                      ).find((status) => statuses.includes(status));

                      return (
                        <tr key={chemical.id}>
                          <td>
                            <div className="chemical-name">
                              <span className="chemical-icon">◇</span>
                              <div>
                                <strong>{chemical.name}</strong>
                                <small>Record #{chemical.id}</small>
                              </div>
                            </div>
                          </td>
                          <td>{chemical.manufacturer || "—"}</td>
                          <td>{chemical.location || "—"}</td>
                          <td>{related.length}</td>
                          <td>
                            {worstStatus ? (
                              <span className={`status-badge ${worstStatus}`}>
                                <span className="status-dot" />
                                {statusLabels[worstStatus]}
                              </span>
                            ) : (
                              <span className="status-badge unknown">
                                No SDS
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredChemicals.length === 0 && (
                      <tr>
                        <td colSpan={5} className="empty-state">
                          No chemical records match your search or filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="records-section" id="documents">
              <div className="section-heading records-heading">
                <div>
                  <h2>Recent SDS documents</h2>
                  <p>Review dates and document status.</p>
                </div>
              </div>
              <div className="document-list">
                {documents.length === 0 ? (
                  <p className="empty-state">No SDS documents found.</p>
                ) : (
                  documents.map((document) => {
                    const chemical = chemicals.find(
                      (item) => item.id === document.chemical
                    );
                    return (
                      <article className="document-row" key={document.id}>
                        <span className="document-icon">▤</span>
                        <div className="document-info">
                          <strong>{document.title}</strong>
                          <small>{chemical?.name ?? "Unknown chemical"}</small>
                        </div>
                        <div className="document-date">
                          <small>Next review</small>
                          <span>{document.next_review_date ?? "Not set"}</span>
                        </div>
                        <span className={`status-badge ${document.review_status}`}>
                          {statusLabels[document.review_status]}
                        </span>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}

        <footer>SafeSheets · Safety documentation workspace · Portfolio project</footer>
      </section>
    </main>
  );
}
