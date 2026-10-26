"use client";

import { useEffect, useMemo, useState } from "react";

import type { FormEvent } from "react";

import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

type ReviewStatus = "current" | "due_soon" | "overdue" | "unknown";

type SDSDocument = {
  id: number;

  chemical: number;

  title: string;

  revision_date?: string | null;

  next_review_date: string | null;

  review_status: ReviewStatus;

  file_reference?: string;

  sds_file?: boolean;
};

type Chemical = {
  id: number;

  name: string;

  manufacturer: string;

  location: string;

  notes?: string;

  sds_documents: SDSDocument[];
};

type SessionResponse = {
  authenticated: boolean;

  username?: string;
};

type ApiErrorData = Record<string, unknown>;

type SDSFormData = {
  chemical: string;

  title: string;

  revision_date: string;

  next_review_date: string;

  file_reference: string;
};

const statusLabels: Record<ReviewStatus, string> = {
  current: "Current",

  due_soon: "Due soon",

  overdue: "Overdue",

  unknown: "Unknown",
};

const emptySDSForm: SDSFormData = {
  chemical: "",

  title: "",

  revision_date: "",

  next_review_date: "",

  file_reference: "",
};

function getApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const errors = data as ApiErrorData;

  if (typeof errors.detail === "string") {
    return errors.detail;
  }

  for (const value of Object.values(errors)) {
    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value) && value.length > 0) {
      return String(value[0]);
    }
  }

  return fallback;
}

export default function Home() {
  const router = useRouter();

  const [authChecking, setAuthChecking] = useState(true);

  const [username, setUsername] = useState("");

  const [chemicals, setChemicals] = useState<Chemical[]>([]);

  const [selectedChemicalId, setSelectedChemicalId] = useState<number | null>(
    null,
  );

  const [documents, setDocuments] = useState<SDSDocument[]>([]);

  const [search, setSearch] = useState("");

  const [filter, setFilter] = useState("all");

  const [documentFilter, setDocumentFilter] = useState("all");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);

  const [editingChemicalId, setEditingChemicalId] = useState<number | null>(
    null,
  );

  const [confirmDeleteChemicalId, setConfirmDeleteChemicalId] = useState<
    number | null
  >(null);

  const [deletingChemical, setDeletingChemical] = useState(false);

  const [savingChemical, setSavingChemical] = useState(false);

  const [formError, setFormError] = useState("");

  const [chemicalName, setChemicalName] = useState("");

  const [manufacturer, setManufacturer] = useState("");

  const [location, setLocation] = useState("");

  const [notes, setNotes] = useState("");

  const [showSDSForm, setShowSDSForm] = useState(false);

  const [editingSDSId, setEditingSDSId] = useState<number | null>(null);

  const [savingSDS, setSavingSDS] = useState(false);

  const [sdsFormError, setSDSFormError] = useState("");

  const [sdsForm, setSDSForm] = useState<SDSFormData>(emptySDSForm);

  const [sdsFile, setSdsFile] = useState<File | null>(null);

  // Verify the Django session before requesting dashboard records.*

  useEffect(() => {
    const controller = new AbortController();

    async function checkSession() {
      try {
        const response = await fetch(`${API_URL}/auth/session/`, {
          credentials: "include",

          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to verify your session.");
        }

        const data: SessionResponse = await response.json();

        if (!data.authenticated) {
          router.replace("/login");

          return;
        }

        setUsername(data.username ?? "");

        setAuthChecking(false);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        router.replace("/login");
      }
    }

    void checkSession();

    return () => controller.abort();
  }, [router]);

  // Load chemicals and SDS documents after authentication.*

  useEffect(() => {
    if (authChecking) {
      return;
    }

    const controller = new AbortController();

    async function loadData() {
      try {
        setLoading(true);

        setError("");

        const [chemicalResponse, documentResponse] = await Promise.all([
          fetch(`${API_URL}/chemicals/`, {
            credentials: "include",

            signal: controller.signal,
          }),

          fetch(`${API_URL}/sds-documents/`, {
            credentials: "include",

            signal: controller.signal,
          }),
        ]);

        if (
          chemicalResponse.status === 401 ||
          chemicalResponse.status === 403 ||
          documentResponse.status === 401 ||
          documentResponse.status === 403
        ) {
          router.replace("/login");

          return;
        }

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
            "Couldn't load SafeSheets data. Check that the Django API is running.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => controller.abort();
  }, [authChecking, router]);

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

      const relatedDocuments = documents.filter(
        (document) => document.chemical === chemical.id,
      );

      const matchesFilter =
        filter === "all" ||
        relatedDocuments.some((document) => document.review_status === filter);

      return matchesSearch && matchesFilter;
    });
  }, [chemicals, documents, search, filter]);

  const count = (status: ReviewStatus) =>
    documents.filter((document) => document.review_status === status).length;

  const chemicalsWithoutSDS = chemicals.filter(
    (chemical) =>
      !documents.some((document) => document.chemical === chemical.id),
  );

  const visibleDocuments =
    documentFilter === "all"
      ? documents
      : documents.filter(
          (document) => document.review_status === documentFilter,
        );

  async function getCsrfToken(): Promise<string> {
    const csrfResponse = await fetch(`${API_URL}/csrf-token/`, {
      credentials: "include",
    });

    if (!csrfResponse.ok) {
      throw new Error("Could not initialize secure submission.");
    }

    const csrfCookie = document.cookie

      .split("; ")

      .find((cookie) => cookie.startsWith("csrftoken="))

      ?.split("=")

      .slice(1)

      .join("=");

    if (!csrfCookie) {
      throw new Error(
        "Security cookie not found. Refresh the page and try again.",
      );
    }

    return decodeURIComponent(csrfCookie);
  }

  async function refreshRecords() {
    const [chemicalResponse, documentResponse] = await Promise.all([
      fetch(`${API_URL}/chemicals/`, {
        credentials: "include",
      }),

      fetch(`${API_URL}/sds-documents/`, {
        credentials: "include",
      }),
    ]);

    if (
      chemicalResponse.status === 401 ||
      chemicalResponse.status === 403 ||
      documentResponse.status === 401 ||
      documentResponse.status === 403
    ) {
      router.replace("/login");

      throw new Error("Your session may have expired. Please log in again.");
    }

    if (!chemicalResponse.ok || !documentResponse.ok) {
      throw new Error(
        "The record was saved, but refreshing the dashboard failed. Reload the page.",
      );
    }

    const [chemicalData, documentData] = await Promise.all([
      chemicalResponse.json(),

      documentResponse.json(),
    ]);

    setChemicals(chemicalData);

    setDocuments(documentData);
  }

  async function handleLogout() {
    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(`${API_URL}/auth/logout/`, {
        method: "POST",

        credentials: "include",

        headers: {
          "X-CSRFToken": csrfToken,
        },
      });

      if (!response.ok) {
        throw new Error("Logout failed. Please try again.");
      }

      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log out.");
    }
  }

  async function handleAddChemical(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError("");

    const name = chemicalName.trim();

    if (!name) {
      setFormError("Chemical name is required.");

      return;
    }

    setSavingChemical(true);
    setNotice("");

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        editingChemicalId === null
          ? `${API_URL}/chemicals/`
          : `${API_URL}/chemicals/${editingChemicalId}/`,
        {
          method: editingChemicalId === null ? "POST" : "PATCH",

          credentials: "include",

          headers: {
            "Content-Type": "application/json",

            "X-CSRFToken": csrfToken,
          },

          body: JSON.stringify({
            name,

            manufacturer: manufacturer.trim(),

            location: location.trim(),

            notes: notes.trim(),
          }),
        },
      );

      if (response.status === 401 || response.status === 403) {
        router.replace("/login");

        return;
      }

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getApiError(
            data,
            editingChemicalId === null
              ? "Could not create the chemical record."
              : "Could not update the chemical record.",
          ),
        );
      }

      await refreshRecords();

      setEditingChemicalId(null);

      setChemicalName("");

      setManufacturer("");

      setLocation("");

      setNotes("");

      setShowAddForm(false);
      setNotice(
        editingChemicalId === null
          ? "Chemical record created."
          : "Chemical record updated.",
      );
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setSavingChemical(false);
    }
  }

  async function handleDeleteChemical(chemical: Chemical) {
    setDeletingChemical(true);
    setError("");
    setNotice("");

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`${API_URL}/chemicals/${chemical.id}/`, {
        method: "DELETE",
        credentials: "include",
        headers: { "X-CSRFToken": csrfToken },
      });

      if (response.status === 401 || response.status === 403) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        throw new Error(getApiError(data, "Could not delete this chemical."));
      }

      setConfirmDeleteChemicalId(null);
      setSelectedChemicalId(null);
      await refreshRecords();
      setNotice("Chemical and linked SDS files deleted.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete this chemical.",
      );
    } finally {
      setDeletingChemical(false);
    }
  }

  async function handleOpenPDF(document: SDSDocument) {
    setError("");
    const pdfWindow = window.open("about:blank", "_blank");

    if (!pdfWindow) {
      setError(
        "Your browser blocked the PDF window. Allow pop-ups and try again.",
      );
      return;
    }
    pdfWindow.opener = null;

    try {
      const response = await fetch(
        `${API_URL}/sds-documents/${document.id}/file/`,

        {
          method: "GET",

          credentials: "include",
        },
      );

      if (response.status === 401 || response.status === 403) {
        pdfWindow.close();
        router.replace("/login");

        return;
      }

      if (!response.ok) {
        pdfWindow.close();
        throw new Error(
          "Could not open this PDF. Check that a file is uploaded.",
        );
      }

      const pdfBlob = await response.blob();

      const pdfUrl = URL.createObjectURL(pdfBlob);
      pdfWindow.location.href = pdfUrl;

      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    } catch (err) {
      pdfWindow.close();
      setError(err instanceof Error ? err.message : "Could not open the PDF.");
    }
  }

  async function handleSaveSDS(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSDSFormError("");

    if (!sdsForm.chemical) {
      setSDSFormError("Please select a chemical.");

      return;
    }

    if (!sdsForm.title.trim()) {
      setSDSFormError("Document title is required.");

      return;
    }

    if (!sdsFile && editingSDSId === null) {
      setSDSFormError("Please select an SDS PDF to upload.");

      return;
    }

    if (sdsFile && !sdsFile.name.toLowerCase().endsWith(".pdf")) {
      setSDSFormError("Please select a PDF file.");

      return;
    }

    if (sdsFile && sdsFile.size > 10 * 1024 * 1024) {
      setSDSFormError("The PDF must be 10 MB or smaller.");

      return;
    }

    setSavingSDS(true);
    setNotice("");

    try {
      const csrfToken = await getCsrfToken();

      const payload = new FormData();

      payload.append("chemical", sdsForm.chemical);

      payload.append("title", sdsForm.title.trim());

      if (sdsFile) payload.append("sds_file", sdsFile);

      payload.append("revision_date", sdsForm.revision_date);
      payload.append("next_review_date", sdsForm.next_review_date);
      payload.append("file_reference", sdsForm.file_reference.trim());

      const response = await fetch(
        editingSDSId === null
          ? `${API_URL}/sds-documents/`
          : `${API_URL}/sds-documents/${editingSDSId}/`,
        {
          method: editingSDSId === null ? "POST" : "PATCH",

          credentials: "include",

          headers: {
            "X-CSRFToken": csrfToken,
          },

          body: payload,
        },
      );

      if (response.status === 401 || response.status === 403) {
        router.replace("/login");

        return;
      }

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getApiError(
            data,
            editingSDSId === null
              ? "Could not upload the SDS document."
              : "Could not update the SDS document.",
          ),
        );
      }

      await refreshRecords();

      setSDSForm(emptySDSForm);

      setSdsFile(null);

      setEditingSDSId(null);

      setShowSDSForm(false);
      setNotice(
        editingSDSId === null ? "SDS document added." : "SDS document updated.",
      );
    } catch (err) {
      setSDSFormError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setSavingSDS(false);
    }
  }

  if (authChecking) {
    return (
      <main className="notice" aria-live="polite">
        Checking your session...
      </main>
    );
  }

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <a className="brand" href="#overview">
          <span className="brand-mark">S</span>

          <span>SafeSheets</span>
        </a>

        <p className="nav-heading">WORKSPACE</p>

        <a className="nav-link active" href="#overview">
          ▦   Overview
        </a>

        <a className="nav-link" href="#chemicals">
          ◇   Chemicals
        </a>

        <a className="nav-link" href="#documents">
          ▤   SDS documents
        </a>

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
            <span className="avatar">
              {(username || "S").charAt(0).toUpperCase()}
            </span>

            <span>{username || "SafeSheets workspace"}</span>

            <button type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        {notice && (
          <p className="success-message" role="status">
            {notice}
          </p>
        )}

        <section className="welcome">
          <div>
            <p className="eyebrow light">YOUR SAFETY WORKSPACE</p>

            <h2>Stay ahead of every review.</h2>

            <p>
              Track chemical records and keep safety documentation organized.
            </p>
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
          <div className="notice error" role="alert">
            {error}
          </div>
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

                <div className="inventory-actions">
                  <span className="record-count">
                    {filteredChemicals.length}{" "}
                    {filteredChemicals.length === 1 ? "record" : "records"}
                  </span>

                  <button
                    type="button"

                    onClick={() => {
                      setShowAddForm((previous) => !previous);

                      setFormError("");
                    }}

                    disabled={savingChemical}
                  >
                    {showAddForm ? "Cancel" : "+ Add Chemical"}
                  </button>
                </div>
              </div>

              {showAddForm && (
                <form
                  className="add-chemical-form"

                  onSubmit={handleAddChemical}
                >
                  <h3>
                    {editingChemicalId === null
                      ? "Add a chemical"
                      : "Edit chemical"}
                  </h3>

                  {formError && (
                    <p className="form-error" role="alert">
                      {formError}
                    </p>
                  )}

                  <div className="form-field">
                    <label htmlFor="chemicalName">Chemical name *</label>

                    <input
                      id="chemicalName"

                      name="name"

                      value={chemicalName}

                      onChange={(event) => setChemicalName(event.target.value)}

                      required

                      maxLength={200}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="manufacturer">Manufacturer</label>

                    <input
                      id="manufacturer"

                      name="manufacturer"

                      value={manufacturer}

                      onChange={(event) => setManufacturer(event.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="chemicalLocation">Storage location</label>

                    <input
                      id="chemicalLocation"

                      name="location"

                      value={location}

                      onChange={(event) => setLocation(event.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="chemicalNotes">Notes</label>

                    <textarea
                      id="chemicalNotes"

                      name="notes"

                      value={notes}

                      onChange={(event) => setNotes(event.target.value)}

                      rows={3}
                    />
                  </div>

                  <div className="form-actions">
                    <button type="submit" disabled={savingChemical}>
                      {savingChemical
                        ? "Saving..."
                        : editingChemicalId === null
                          ? "Save Chemical"
                          : "Save Changes"}
                    </button>

                    <button
                      type="button"

                      className="secondary-button"

                      onClick={() => {
                        setShowAddForm(false);

                        setEditingChemicalId(null);

                        setChemicalName("");

                        setManufacturer("");

                        setLocation("");

                        setNotes("");

                        setFormError("");
                      }}

                      disabled={savingChemical}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

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

                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredChemicals.map((chemical) => {
                      const related = documents.filter(
                        (document) => document.chemical === chemical.id,
                      );

                      const statuses = related.map(
                        (document) => document.review_status,
                      );

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
                          <td>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => setSelectedChemicalId(chemical.id)}
                            >
                              View details
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredChemicals.length === 0 && (
                      <tr>
                        <td colSpan={6} className="empty-state">
                          No chemical records match your search or filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selectedChemicalId !== null &&
                (() => {
                  const selectedChemical = chemicals.find(
                    (item) => item.id === selectedChemicalId,
                  );
                  if (!selectedChemical) return null;

                  const relatedDocuments = documents.filter(
                    (document) => document.chemical === selectedChemical.id,
                  );

                  return (
                    <section
                      className="chemical-details-panel"
                      aria-label="Chemical details"
                    >
                      <div className="section-heading">
                        <div>
                          <h3>{selectedChemical.name}</h3>
                          <p>Chemical record #{selectedChemical.id}</p>
                        </div>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setSelectedChemicalId(null)}
                        >
                          Close details
                        </button>
                      </div>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setEditingChemicalId(selectedChemical.id);
                          setChemicalName(selectedChemical.name);
                          setManufacturer(selectedChemical.manufacturer);
                          setLocation(selectedChemical.location);
                          setNotes(selectedChemical.notes ?? "");
                          setFormError("");
                          setShowAddForm(true);
                          document
                            .getElementById("chemicals")
                            ?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        Edit chemical
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() =>
                          setConfirmDeleteChemicalId(selectedChemical.id)
                        }
                      >
                        Delete chemical
                      </button>
                      <p>
                        <strong>Manufacturer:</strong>{" "}
                        {selectedChemical.manufacturer || "Not provided"}
                      </p>
                      <p>
                        <strong>Storage location:</strong>{" "}
                        {selectedChemical.location || "Not provided"}
                      </p>
                      <p>
                        <strong>Notes:</strong>{" "}
                        {selectedChemical.notes || "No notes provided"}
                      </p>
                      <h4>Associated SDS documents</h4>
                      {relatedDocuments.length === 0 ? (
                        <p>No SDS documents are linked to this chemical.</p>
                      ) : (
                        <ul>
                          {relatedDocuments.map((document) => (
                            <li key={document.id}>
                              <strong>{document.title}</strong>
                              {" — "}
                              {statusLabels[document.review_status]}
                              {" · "}
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => void handleOpenPDF(document)}
                                disabled={!document.sds_file}
                              >
                                {document.sds_file
                                  ? "Open PDF"
                                  : "No PDF uploaded"}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  );
                })()}
            </section>

            <section
              className="records-section"
              aria-labelledby="missing-sds-title"
            >
              <div className="section-heading">
                <div>
                  <h2 id="missing-sds-title">Chemicals without an SDS</h2>
                  <p>
                    Inventory records that do not have a linked SDS document.
                  </p>
                </div>
                <span className="record-count">
                  {chemicalsWithoutSDS.length}
                </span>
              </div>
              {chemicalsWithoutSDS.length === 0 ? (
                <p className="empty-state">
                  Every chemical has at least one linked SDS record.
                </p>
              ) : (
                <ul className="missing-sds-list">
                  {chemicalsWithoutSDS.map((chemical) => (
                    <li key={chemical.id}>
                      <span>{chemical.name}</span>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setSDSForm((previous) => ({
                            ...previous,
                            chemical: String(chemical.id),
                          }));
                          setEditingSDSId(null);
                          setShowSDSForm(true);
                          document
                            .getElementById("documents")
                            ?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        Add SDS
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="records-section" id="documents">
              <div className="section-heading records-heading">
                <div>
                  <h2>Recent SDS documents</h2>

                  <p>Review dates and document status.</p>
                </div>

                <button
                  type="button"

                  className="add-chemical-button"

                  onClick={() => {
                    setShowSDSForm((previous) => !previous);
                    setEditingSDSId(null);
                    setSDSForm(emptySDSForm);
                    setSdsFile(null);

                    setSDSFormError("");
                  }}

                  disabled={savingSDS || chemicals.length === 0}

                  title={
                    chemicals.length === 0
                      ? "Create a chemical before adding an SDS document."
                      : "Add an SDS document"
                  }
                >
                  {showSDSForm ? "Cancel" : "+ Add SDS Document"}
                </button>
              </div>

              {chemicals.length === 0 && (
                <p className="empty-state">
                  Add a chemical before creating an SDS document.
                </p>
              )}

              {showSDSForm && chemicals.length > 0 && (
                <form className="add-chemical-form" onSubmit={handleSaveSDS}>
                  <h3>
                    {editingSDSId === null
                      ? "Add an SDS document"
                      : "Edit SDS document"}
                  </h3>

                  {sdsFormError && (
                    <p className="form-error" role="alert">
                      {sdsFormError}
                    </p>
                  )}

                  <div className="form-field">
                    <label htmlFor="sdsChemical">Chemical *</label>

                    <select
                      id="sdsChemical"

                      value={sdsForm.chemical}

                      onChange={(event) =>
                        setSDSForm((previous) => ({
                          ...previous,

                          chemical: event.target.value,
                        }))
                      }

                      required
                    >
                      <option value="">Select a chemical</option>

                      {chemicals.map((chemical) => (
                        <option key={chemical.id} value={chemical.id}>
                          {chemical.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="sdsTitle">Document title *</label>

                    <input
                      id="sdsTitle"

                      value={sdsForm.title}

                      onChange={(event) =>
                        setSDSForm((previous) => ({
                          ...previous,

                          title: event.target.value,
                        }))
                      }

                      required

                      maxLength={200}

                      placeholder="e.g. Sodium Chloride SDS"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="sdsRevisionDate">Revision date</label>

                    <input
                      id="sdsRevisionDate"

                      type="date"

                      value={sdsForm.revision_date}

                      onChange={(event) =>
                        setSDSForm((previous) => ({
                          ...previous,

                          revision_date: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="sdsNextReviewDate">Next review date</label>

                    <input
                      id="sdsNextReviewDate"

                      type="date"

                      value={sdsForm.next_review_date}

                      onChange={(event) =>
                        setSDSForm((previous) => ({
                          ...previous,

                          next_review_date: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="sdsPdf">SDS PDF *</label>

                    <input
                      id="sdsPdf"

                      name="sds_file"

                      type="file"

                      accept=".pdf,application/pdf"

                      required={editingSDSId === null}

                      disabled={savingSDS}

                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;

                        setSdsFile(file);

                        setSDSFormError("");
                      }}
                    />

                    <small>
                      {editingSDSId === null
                        ? "PDF required. Maximum size: 10 MB."
                        : "Optional replacement PDF. Maximum size: 10 MB."}
                    </small>

                    {sdsFile && (
                      <small>
                        Selected: {sdsFile.name} (
                        {(sdsFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </small>
                    )}
                  </div>

                  <div className="form-field">
                    <label htmlFor="sdsFileReference">
                      File reference (optional)
                    </label>

                    <input
                      id="sdsFileReference"

                      value={sdsForm.file_reference}

                      disabled={savingSDS}

                      onChange={(event) =>
                        setSDSForm((previous) => ({
                          ...previous,

                          file_reference: event.target.value,
                        }))
                      }

                      placeholder="Optional reference or identifier"
                    />
                  </div>

                  <div className="form-actions">
                    <button type="submit" disabled={savingSDS}>
                      {savingSDS
                        ? "Saving..."
                        : editingSDSId === null
                          ? "Save SDS Document"
                          : "Save Changes"}
                    </button>

                    <button
                      type="button"

                      className="secondary-button"

                      onClick={() => {
                        setShowSDSForm(false);

                        setSDSFormError("");
                        setEditingSDSId(null);
                        setSDSForm(emptySDSForm);
                        setSdsFile(null);
                      }}

                      disabled={savingSDS}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="document-list">
                <div className="document-filter">
                  <label htmlFor="documentStatusFilter">Filter documents</label>
                  <select
                    id="documentStatusFilter"
                    value={documentFilter}
                    onChange={(event) => setDocumentFilter(event.target.value)}
                  >
                    <option value="all">All statuses</option>
                    <option value="overdue">Overdue</option>
                    <option value="due_soon">Due soon</option>
                    <option value="current">Current</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                {visibleDocuments.length === 0 ? (
                  <p className="empty-state">
                    {documents.length === 0
                      ? "No SDS documents found. Add an SDS document to get started."
                      : "No SDS documents match this review status."}
                  </p>
                ) : (
                  visibleDocuments.map((document) => {
                    const chemical = chemicals.find(
                      (item) => item.id === document.chemical,
                    );

                    return (
                      <article className="document-row" key={document.id}>
                        <span className="document-icon">▤</span>

                        <div className="document-info">
                          <strong>{document.title}</strong>

                          <small>{chemical?.name ?? "Unknown chemical"}</small>
                          <small>
                            Revision: {document.revision_date ?? "Not provided"}
                          </small>
                        </div>

                        <div className="document-date">
                          <small>Next review</small>

                          <span>{document.next_review_date ?? "Not set"}</span>
                        </div>

                        <span
                          className={`status-badge ${document.review_status}`}
                        >
                          {statusLabels[document.review_status]}
                        </span>

                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setEditingSDSId(document.id);
                            setSDSForm({
                              chemical: String(document.chemical),
                              title: document.title,
                              revision_date: document.revision_date ?? "",
                              next_review_date: document.next_review_date ?? "",
                              file_reference: document.file_reference ?? "",
                            });
                            setSdsFile(null);
                            setSDSFormError("");
                            setShowSDSForm(true);
                            window.document
                              .getElementById("documents")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => void handleOpenPDF(document)}
                          disabled={!document.sds_file}
                        >
                          {document.sds_file ? "Open PDF" : "No PDF"}
                        </button>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}

        {confirmDeleteChemicalId !== null &&
          (() => {
            const chemical = chemicals.find(
              (item) => item.id === confirmDeleteChemicalId,
            );
            if (!chemical) return null;

            return (
              <div className="dialog-backdrop">
                <section
                  className="confirm-dialog"
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="delete-chemical-title"
                  aria-describedby="delete-chemical-description"
                >
                  <h2 id="delete-chemical-title">Delete {chemical.name}?</h2>
                  <p id="delete-chemical-description">
                    This permanently removes the chemical, its linked SDS
                    records, and their uploaded PDF files. This action cannot be
                    undone.
                  </p>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="danger-button"
                      disabled={deletingChemical}
                      onClick={() => void handleDeleteChemical(chemical)}
                    >
                      {deletingChemical
                        ? "Deleting…"
                        : "Delete chemical and SDS files"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      autoFocus
                      disabled={deletingChemical}
                      onClick={() => setConfirmDeleteChemicalId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </section>
              </div>
            );
          })()}

        <footer>
          SafeSheets · Safety documentation workspace · Portfolio project
        </footer>
      </section>
    </main>
  );
}
