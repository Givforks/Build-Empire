import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import BuildEmpireSection from "./BuildEmpireSection";

type PreferredDate = { date: string; timeSlots: string[] };

type SuperuserPublic = { rank?: string; specializations?: string[] };

type Superuser = {
  id: string;
  fullName?: string;
  email?: string;
  rank?: string;
  specializations?: string[];
};

type Appointment = {
  id: string;
  topic: string;
  status: string;
  adminId: string;
  clientId: string;
  superuserId?: string;
  preferredDates: PreferredDate[];
  adminDecidedDateTime?: string;
  summaryEmailStatus?: string;
  superuser?: SuperuserPublic | Superuser;
  attachments: Array<{ id: string; type: string; fileName: string }>;
};

type InboxMessage = {
  id: string;
  fromUserId: string;
  toUserId: string;
  body: string;
  appointmentId?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
};

type Me = {
  id: string;
  role: "client" | "admin" | "superuser";
  email?: string;
  username?: string;
  fullName?: string;
};

type ManagedUser = {
  id: string;
  role: "client" | "superuser";
  email?: string;
  username?: string;
  fullName?: string;
  rank?: string;
  specializations?: string[];
  state?: string;
  isActive?: boolean;
  createdAt: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function api<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {})
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || body.details || "Request failed");
  }
  return body as T;
}

export default function App() {
  const showEmpireSection = import.meta.env.VITE_SHOW_EMPIRE_SECTION !== "false";
  const [mode, setMode] = useState<"client" | "admin" | "superuser">("client");
  const [token, setToken] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState("Ready");

  const [email, setEmail] = useState("client@example.com");
  const [password, setPassword] = useState("ClientPass123!");
  const [fullName, setFullName] = useState("Client Example");
  const [state, setState] = useState("Lagos");

  const [adminUsername, setAdminUsername] = useState("GivenchiCodes");
  const [adminPassword, setAdminPassword] = useState("Givenchi1@@@@@");

  const [superuserEmail, setSuperuserEmail] = useState("superuser@example.com");
  const [superuserPassword, setSuperuserPassword] = useState("TempSuper123!");

  const [topic, setTopic] = useState("I need strategic guidance for my product and launch timeline.");
  const [preferredDate, setPreferredDate] = useState("2026-06-15");
  const [preferredTime, setPreferredTime] = useState("10:00");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [adminPanel, setAdminPanel] = useState<"overview" | "clients" | "superusers" | "appointments" | "messages" | "analytics">("overview");
  const [analytics, setAnalytics] = useState<{ totalUsers?: number; totalAppointments?: number; statusCounts?: Record<string, number>; avgDecisionHours?: number } | null>(null);
  const [clientDraftId, setClientDraftId] = useState("");
  const [clientDraftName, setClientDraftName] = useState("");
  const [clientDraftEmail, setClientDraftEmail] = useState("");
  const [clientDraftPassword, setClientDraftPassword] = useState("");
  const [clientDraftState, setClientDraftState] = useState("");
  const [clientDraftActive, setClientDraftActive] = useState(true);
  const [superuserDraftId, setSuperuserDraftId] = useState("");
  const [superuserDraftName, setSuperuserDraftName] = useState("");
  const [superuserDraftEmail, setSuperuserDraftEmail] = useState("");
  const [superuserDraftPassword, setSuperuserDraftPassword] = useState("");
  const [superuserDraftRank, setSuperuserDraftRank] = useState("");
  const [superuserDraftSpecs, setSuperuserDraftSpecs] = useState("");
  const [superuserDraftState, setSuperuserDraftState] = useState("");
  const [superuserDraftActive, setSuperuserDraftActive] = useState(true);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const selectedAppointment = useMemo(
    () => appointments.find((a) => a.id === selectedAppointmentId) || null,
    [appointments, selectedAppointmentId]
  );

  const [deepseekPrompt, setDeepseekPrompt] = useState(
    "I want to discuss product-market fit, growth priorities, and execution constraints."
  );
  const [aiOutput, setAiOutput] = useState("");

  const [newSuperuserName, setNewSuperuserName] = useState("Consultant Prime");
  const [newSuperuserEmail, setNewSuperuserEmail] = useState("consultant.prime@example.com");
  const [newSuperuserPassword, setNewSuperuserPassword] = useState("SuperuserPass123!");
  const [newSuperuserRank, setNewSuperuserRank] = useState("Principal Advisor");
  const [newSuperuserSpecs, setNewSuperuserSpecs] = useState("AI Strategy, Product Leadership");

  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [chatBody, setChatBody] = useState("Hello, I want to discuss my pending appointment request.");
  const [socket, setSocket] = useState<Socket | null>(null);
  const isAuthenticated = Boolean(token && me);

  function showDashboardView() {
    window.location.hash = "dashboard";
  }

  function logout() {
    setToken("");
    setMe(null);
    setAppointments([]);
    setManagedUsers([]);
    setInbox([]);
    setSocket(null);
    setStatus("Signed out");
    setMode("client");
    window.location.hash = "";
  }

  function resetClientDraft(user?: ManagedUser) {
    setClientDraftId(user?.id || "");
    setClientDraftName(user?.fullName || "");
    setClientDraftEmail(user?.email || "");
    setClientDraftPassword("");
    setClientDraftState(user?.state || "");
    setClientDraftActive(user?.isActive ?? true);
  }

  function resetSuperuserDraft(user?: ManagedUser) {
    setSuperuserDraftId(user?.id || "");
    setSuperuserDraftName(user?.fullName || "");
    setSuperuserDraftEmail(user?.email || "");
    setSuperuserDraftPassword("");
    setSuperuserDraftRank(user?.rank || "");
    setSuperuserDraftSpecs((user?.specializations || []).join(", "));
    setSuperuserDraftState(user?.state || "");
    setSuperuserDraftActive(user?.isActive ?? true);
  }

  async function fetchMe(authToken: string) {
    const user = await api<Me>("/api/me", authToken);
    setMe(user);
    return user;
  }

  async function signupClient() {
    try {
      const payload = {
        email,
        password,
        fullName,
        state,
        preferredDates: [{ date: preferredDate, timeSlots: [preferredTime] }]
      };
      const out = await api<{ token: string }>("/api/auth/signup", undefined, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setMe(null);
      setToken(out.token);
      const user = await fetchMe(out.token);
      setMode("client");
      setStatus(`Signed up as ${user.fullName || user.email}`);
      showDashboardView();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function loginClient() {
    try {
      const out = await api<{ token: string }>("/api/auth/login", undefined, {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setMe(null);
      setToken(out.token);
      const user = await fetchMe(out.token);
      setMode("client");
      setStatus(`Client login successful (${user.email})`);
      showDashboardView();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function loginAdmin() {
    try {
      const out = await api<{ token: string }>("/api/auth/admin-login", undefined, {
        method: "POST",
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      });
      setMe(null);
      setToken(out.token);
      const user = await fetchMe(out.token);
      setMode("admin");
      setStatus(`Admin login successful (${user.username})`);
      showDashboardView();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function loginSuperuser() {
    try {
      const out = await api<{ token: string }>("/api/auth/superuser-login", undefined, {
        method: "POST",
        body: JSON.stringify({ email: superuserEmail, password: superuserPassword })
      });
      setMe(null);
      setToken(out.token);
      const user = await fetchMe(out.token);
      setMode("superuser");
      setStatus(`Superuser login successful (${user.email})`);
      showDashboardView();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function loadAppointments() {
    if (!token) return;
    try {
      const list = await api<Appointment[]>("/api/appointments", token);
      setAppointments(list);
      if (!selectedAppointmentId && list.length > 0) {
        setSelectedAppointmentId(list[0].id);
      }
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function loadManagedUsers() {
    if (!token || me?.role !== "admin") return;
    try {
      const rows = await api<ManagedUser[]>("/api/admin/users?role=superuser", token);
      setManagedUsers(rows);
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function loadClients() {
    if (!token || me?.role !== "admin") return;
    try {
      const rows = await api<ManagedUser[]>("/api/admin/users?role=client", token);
      setManagedUsers((prev) => {
        const superuserRows = prev.filter((item) => item.role === "superuser");
        return [...rows, ...superuserRows];
      });
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function loadAdminUsers() {
    if (!token || me?.role !== "admin") return;
    try {
      const [clients, superusers] = await Promise.all([
        api<ManagedUser[]>("/api/admin/users?role=client", token),
        api<ManagedUser[]>("/api/admin/users?role=superuser", token)
      ]);
      setManagedUsers([...clients, ...superusers]);
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function loadAdminAnalytics() {
    if (!token || me?.role !== "admin") return;
    try {
      const out = await api<{
        totalUsers: number;
        totalAppointments: number;
        statusCounts: Record<string, number>;
        avgDecisionHours: number;
      }>("/api/admin/analytics", token);
      setAnalytics(out);
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function createAppointment() {
    if (!token || me?.role !== "client") return;
    try {
      const payload = {
        topic,
        preferredDates: [{ date: preferredDate, timeSlots: [preferredTime] }]
      };
      const out = await api<{ id: string }>("/api/appointments", token, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setStatus(`Appointment created: ${out.id}`);
      await loadAppointments();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function requestReschedule() {
    if (!token || me?.role !== "client" || !selectedAppointment) return;
    try {
      const payload = {
        proposedDates: [{ date: preferredDate, timeSlots: [preferredTime] }],
        reason: "Need a better alignment window"
      };
      await api(`/api/appointments/${selectedAppointment.id}/reschedule`, token, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setStatus("Reschedule submitted");
      await loadAppointments();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function saveClient() {
    if (!token || me?.role !== "admin") return;
    try {
      const payload = {
        email: clientDraftEmail,
        password: clientDraftPassword || "ClientPass123!",
        fullName: clientDraftName,
        state: clientDraftState,
        isActive: clientDraftActive
      };
      if (clientDraftId) {
        await api(`/api/admin/users/${clientDraftId}`, token, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        setStatus("Client updated");
      } else {
        await api("/api/admin/users", token, {
          method: "POST",
          body: JSON.stringify({ ...payload, role: "client" })
        });
        setStatus("Client created");
      }
      resetClientDraft();
      await loadAdminUsers();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function saveSuperuser() {
    if (!token || me?.role !== "admin") return;
    try {
      const payload = {
        email: superuserDraftEmail,
        password: superuserDraftPassword || "TempSuper123!",
        fullName: superuserDraftName,
        rank: superuserDraftRank,
        specializations: superuserDraftSpecs.split(",").map((item) => item.trim()).filter(Boolean),
        state: superuserDraftState,
        isActive: superuserDraftActive
      };
      if (superuserDraftId) {
        await api(`/api/admin/users/${superuserDraftId}`, token, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        setStatus("Superuser updated");
      } else {
        await api("/api/admin/users", token, {
          method: "POST",
          body: JSON.stringify({ ...payload, role: "superuser" })
        });
        setStatus("Superuser created");
      }
      resetSuperuserDraft();
      await loadAdminUsers();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function removeManagedUser(id: string) {
    if (!token || me?.role !== "admin") return;
    try {
      await api(`/api/admin/users/${id}`, token, {
        method: "DELETE"
      });
      setStatus("User deleted");
      await loadAdminUsers();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function createSuperuser() {
    if (!token || me?.role !== "admin") return;
    try {
      await api("/api/admin/superusers", token, {
        method: "POST",
        body: JSON.stringify({
          fullName: newSuperuserName,
          email: newSuperuserEmail,
          password: newSuperuserPassword,
          rank: newSuperuserRank,
          specializations: newSuperuserSpecs.split(",").map((s) => s.trim()).filter(Boolean),
          state
        })
      });
      setStatus("Superuser created");
      await loadAdminUsers();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function forwardToSuperuser(superuserId: string) {
    if (!token || me?.role !== "admin" || !selectedAppointment) return;
    try {
      await api(`/api/admin/appointments/${selectedAppointment.id}/forward`, token, {
        method: "POST",
        body: JSON.stringify({ superuserId })
      });
      setStatus("Appointment forwarded to superuser");
      await loadAppointments();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function decideAppointment(decision: "APPROVED" | "REJECTED") {
    if (!token || me?.role !== "admin" || !selectedAppointment) return;
    try {
      await api(`/api/admin/appointments/${selectedAppointment.id}/decision`, token, {
        method: "POST",
        body: JSON.stringify({
          decision,
          adminDecidedDateTime: decision === "APPROVED" ? `${preferredDate}T${preferredTime}:00Z` : undefined
        })
      });
      setStatus(`Appointment ${decision.toLowerCase()}`);
      await loadAppointments();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function respondAsSuperuser(accepted: boolean) {
    if (!token || me?.role !== "superuser" || !selectedAppointment) return;
    try {
      await api(`/api/superuser/appointments/${selectedAppointment.id}/respond`, token, {
        method: "POST",
        body: JSON.stringify({ accepted })
      });
      setStatus(accepted ? "Superuser accepted the appointment" : "Superuser rejected the appointment");
      await loadAppointments();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function generateDeepseekSummary() {
    if (!token || me?.role !== "client" || !selectedAppointment) return;
    try {
      const out = await api<{ content: string }>("/api/ai/deepseek", token, {
        method: "POST",
        body: JSON.stringify({ appointmentId: selectedAppointment.id, prompt: deepseekPrompt })
      });
      setAiOutput(out.content);
      setStatus("README.md and PDF generated for this appointment");
      await loadAppointments();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function sendSummaryEmail(superuserId: string) {
    if (!token || me?.role !== "admin" || !selectedAppointment) return;
    try {
      await api("/api/admin/appointments/send-summary-email", token, {
        method: "POST",
        body: JSON.stringify({
          appointmentId: selectedAppointment.id,
          superuserId,
          message: "Please review the attached meeting brief before confirming."
        })
      });
      setStatus("Summary email dispatched");
      await loadAppointments();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function loadInbox() {
    if (!token) return;
    try {
      const out = await api<{ unreadCount: number; messages: InboxMessage[] }>("/api/inbox", token);
      setInbox(out.messages);
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function sendChat() {
    if (!token || !me) return;
    try {
      if (me.role === "client") {
        const adminId = selectedAppointment?.adminId || appointments[0]?.adminId;
        if (!adminId) throw new Error("No admin target available yet");
        await api("/api/chat/send", token, {
          method: "POST",
          body: JSON.stringify({ toUserId: adminId, body: chatBody, appointmentId: selectedAppointment?.id })
        });
      }
      if (me.role === "admin") {
        const clientId = selectedAppointment?.clientId;
        if (!clientId) throw new Error("Select an appointment first");
        await api("/api/chat/send", token, {
          method: "POST",
          body: JSON.stringify({ toUserId: clientId, body: chatBody, appointmentId: selectedAppointment?.id })
        });
      }
      setChatBody("");
      setStatus("Message sent");
      await loadInbox();
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  useEffect(() => {
    if (!token || !me) return;

    const s = io(API_BASE, { transports: ["websocket"] });
    s.on("connect", () => {
      s.emit("auth:bind", me.id);
    });

    s.on("chat:message", (msg: InboxMessage) => {
      setInbox((prev) => [msg, ...prev]);
    });

    s.on("chat:delivery", () => {
      setStatus("Chat message delivered");
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [token, me]);

  useEffect(() => {
    if (!token) return;
    void loadAppointments();
    void loadInbox();
  }, [token]);

  useEffect(() => {
    if (!token || me?.role !== "admin") return;
    void loadAdminUsers();
  }, [token, me]);

  useEffect(() => {
    if (!socket || !me) return;
    socket.emit("auth:bind", me.id);
  }, [socket, me]);

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Build-Empire</span>
          <h1>Production control for clients, admins, and superusers.</h1>
          <p>
            Purple navy glass UI, role-aware workflows, and a management surface built for fast iteration and future
            expansion.
          </p>
          {!isAuthenticated ? (
            <div className="mode-tabs">
              <button className={mode === "client" ? "active" : ""} onClick={() => setMode("client")}>Client</button>
              <button className={mode === "admin" ? "active" : ""} onClick={() => setMode("admin")}>Admin</button>
              <button className={mode === "superuser" ? "active" : ""} onClick={() => setMode("superuser")}>Superuser</button>
            </div>
          ) : (
            <div className="hero-actions">
              <span className="pill">{me?.role}</span>
              <button className="ghost" onClick={logout}>Logout</button>
            </div>
          )}
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orb orb-a" />
          <div className="orb orb-b" />
          <div className="model-card model-main">
            <span>Workflow</span>
            <strong>Dynamic CRUD</strong>
            <small>Client, superuser, appointments, inbox</small>
          </div>
          <div className="model-card model-side">
            <span>Signal</span>
            <strong>Realtime</strong>
            <small>Socket + auth binding</small>
          </div>
        </div>
      </header>

      {!isAuthenticated && mode === "client" && (
        <section className="card auth-card">
          <h2>Client access</h2>
          <p className="muted">New clients can sign up here and jump straight into the dashboard.</p>
          <div className="grid">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
            <input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" />
          </div>
          <div className="row">
            <button onClick={signupClient}>Sign up</button>
            <button className="ghost" onClick={loginClient}>Login</button>
          </div>
        </section>
      )}

      {!isAuthenticated && mode === "admin" && (
        <section className="card auth-card">
          <h2>Admin access</h2>
          <p className="muted">Admin controls create, update, and remove clients and superusers from one console.</p>
          <div className="grid">
            <input value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="Admin username" />
            <input value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Admin password" type="password" />
          </div>
          <div className="row">
            <button onClick={loginAdmin}>Admin login</button>
          </div>
        </section>
      )}

      {!isAuthenticated && mode === "superuser" && (
        <section className="card auth-card">
          <h2>Superuser login</h2>
          <p className="muted">Superusers sign in only. Admins manage their accounts from the dashboard.</p>
          <div className="grid">
            <input value={superuserEmail} onChange={(e) => setSuperuserEmail(e.target.value)} placeholder="Superuser email" />
            <input value={superuserPassword} onChange={(e) => setSuperuserPassword(e.target.value)} placeholder="Password" type="password" />
          </div>
          <div className="row">
            <button onClick={loginSuperuser}>Superuser login</button>
          </div>
        </section>
      )}

      {showEmpireSection && <BuildEmpireSection />}

      {isAuthenticated && (
        <>
          <section className="card hero-summary" id="dashboard">
            <div>
              <h2>{me?.role === "admin" ? "Admin Console" : me?.role === "superuser" ? "Superuser Console" : "Client Dashboard"}</h2>
              <p>
                Signed in as {me?.role === "admin" ? `admin ${me.username || me.email}` : me?.fullName || me?.email}.
              </p>
            </div>
            <div className="summary-grid">
              <div>
                <span>Appointments</span>
                <strong>{appointments.length}</strong>
              </div>
              <div>
                <span>Inbox</span>
                <strong>{inbox.length}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{status}</strong>
              </div>
            </div>
          </section>

          {me?.role === "admin" && (
            <section className="card tabbed-shell">
              <div className="panel-tabs">
                {(["overview", "clients", "superusers", "appointments", "messages", "analytics"] as const).map((tab) => (
                  <button key={tab} className={adminPanel === tab ? "active" : ""} onClick={() => setAdminPanel(tab)}>
                    {tab}
                  </button>
                ))}
              </div>

              {adminPanel === "overview" && (
                <div className="stack">
                  <div className="glass-grid">
                    <article className="glass-tile">
                      <span>Clients</span>
                      <strong>{managedUsers.filter((item) => item.role === "client").length}</strong>
                    </article>
                    <article className="glass-tile">
                      <span>Superusers</span>
                      <strong>{managedUsers.filter((item) => item.role === "superuser").length}</strong>
                    </article>
                    <article className="glass-tile">
                      <span>Total users</span>
                      <strong>{analytics?.totalUsers ?? managedUsers.length}</strong>
                    </article>
                    <article className="glass-tile">
                      <span>Selected</span>
                      <strong>{selectedAppointment?.topic || "None"}</strong>
                    </article>
                  </div>
                  <div className="row">
                    <button onClick={() => setAdminPanel("clients")}>Manage clients</button>
                    <button className="ghost" onClick={() => setAdminPanel("superusers")}>Manage superusers</button>
                    <button className="ghost" onClick={loadAdminUsers}>Refresh users</button>
                    <button className="ghost" onClick={loadAdminAnalytics}>Load analytics</button>
                  </div>
                </div>
              )}

              {adminPanel === "analytics" && (
                <div className="stack">
                  <h2>Analytics</h2>
                  <div className="grid">
                    <div className="metric">
                      <span>Total appointments</span>
                      <strong>{analytics?.totalAppointments ?? appointments.length}</strong>
                    </div>
                    <div className="metric">
                      <span>Avg decision time (hrs)</span>
                      <strong>{analytics?.avgDecisionHours ? analytics.avgDecisionHours.toFixed(1) : "N/A"}</strong>
                    </div>
                    <div className="metric">
                      <span>Statuses</span>
                      <div>
                        {analytics?.statusCounts
                          ? Object.entries(analytics.statusCounts).map(([k, v]) => (
                              <div key={k}>{k}: {v}</div>
                            ))
                          : <div>No status data</div>}
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <button onClick={loadAdminAnalytics}>Refresh analytics</button>
                  </div>
                </div>
              )}

              {adminPanel === "clients" && (
                <div className="stack">
                  <h2>Client CRUD</h2>
                  <div className="grid">
                    <input value={clientDraftName} onChange={(e) => setClientDraftName(e.target.value)} placeholder="Full name" />
                    <input value={clientDraftEmail} onChange={(e) => setClientDraftEmail(e.target.value)} placeholder="Email" />
                    <input value={clientDraftPassword} onChange={(e) => setClientDraftPassword(e.target.value)} placeholder="Password" type="password" />
                    <input value={clientDraftState} onChange={(e) => setClientDraftState(e.target.value)} placeholder="State" />
                    <label className="toggle-row"><input type="checkbox" checked={clientDraftActive} onChange={(e) => setClientDraftActive(e.target.checked)} /> Active</label>
                  </div>
                  <div className="row">
                    <button onClick={saveClient}>{clientDraftId ? "Update client" : "Create client"}</button>
                    <button className="ghost" onClick={() => resetClientDraft()}>Clear</button>
                  </div>
                  <div className="user-list">
                    {managedUsers.filter((item) => item.role === "client").map((client) => (
                      <article className="user-card" key={client.id}>
                        <div>
                          <strong>{client.fullName}</strong>
                          <p>{client.email}</p>
                          <small>{client.state || "No state"} · {client.isActive ? "Active" : "Disabled"}</small>
                        </div>
                        <div className="row compact">
                          <button className="ghost" onClick={() => resetClientDraft(client)}>Edit</button>
                          <button className="danger" onClick={() => removeManagedUser(client.id)}>Delete</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {adminPanel === "superusers" && (
                <div className="stack">
                  <h2>Superuser CRUD</h2>
                  <div className="grid">
                    <input value={superuserDraftName} onChange={(e) => setSuperuserDraftName(e.target.value)} placeholder="Full name" />
                    <input value={superuserDraftEmail} onChange={(e) => setSuperuserDraftEmail(e.target.value)} placeholder="Email" />
                    <input value={superuserDraftPassword} onChange={(e) => setSuperuserDraftPassword(e.target.value)} placeholder="Password" type="password" />
                    <input value={superuserDraftRank} onChange={(e) => setSuperuserDraftRank(e.target.value)} placeholder="Rank" />
                    <input value={superuserDraftSpecs} onChange={(e) => setSuperuserDraftSpecs(e.target.value)} placeholder="Specializations comma-separated" />
                    <input value={superuserDraftState} onChange={(e) => setSuperuserDraftState(e.target.value)} placeholder="State" />
                    <label className="toggle-row"><input type="checkbox" checked={superuserDraftActive} onChange={(e) => setSuperuserDraftActive(e.target.checked)} /> Active</label>
                  </div>
                  <div className="row">
                    <button onClick={saveSuperuser}>{superuserDraftId ? "Update superuser" : "Create superuser"}</button>
                    <button className="ghost" onClick={() => resetSuperuserDraft()}>Clear</button>
                  </div>
                  <div className="user-list">
                    {managedUsers.filter((item) => item.role === "superuser").map((superuser) => (
                      <article className="user-card" key={superuser.id}>
                        <div>
                          <strong>{superuser.fullName}</strong>
                          <p>{superuser.email}</p>
                          <small>
                            {superuser.rank || "No rank"} · {(superuser.specializations || []).join(", ") || "No specializations"}
                          </small>
                        </div>
                        <div className="row compact">
                          <button className="ghost" onClick={() => resetSuperuserDraft(superuser)}>Edit</button>
                          <button className="danger" onClick={() => removeManagedUser(superuser.id)}>Delete</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {adminPanel === "appointments" && (
                <div className="stack">
                  <h2>Appointment operations</h2>
                  <div className="row">
                    <button onClick={loadAppointments}>Refresh appointments</button>
                  </div>
                  <div className="stack">
                    {appointments.map((item) => (
                      <button key={item.id} className={`appointment-item ${selectedAppointmentId === item.id ? "selected" : ""}`} onClick={() => setSelectedAppointmentId(item.id)}>
                        <strong>{item.topic}</strong>
                        <span>{item.status}</span>
                        <span>{item.clientId}</span>
                      </button>
                    ))}
                  </div>
                  {selectedAppointment && (
                    <div className="row">
                      <button onClick={() => decideAppointment("APPROVED")}>Approve</button>
                      <button className="danger" onClick={() => decideAppointment("REJECTED")}>Reject</button>
                      {managedUsers.filter((item) => item.role === "superuser").map((superuser) => (
                        <button key={superuser.id} className="ghost" onClick={() => forwardToSuperuser(superuser.id)}>
                          Forward to {superuser.fullName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {adminPanel === "messages" && (
                <div className="stack">
                  <h2>Messaging</h2>
                  <textarea value={chatBody} onChange={(e) => setChatBody(e.target.value)} rows={4} placeholder="Type message" />
                  <div className="row">
                    <button onClick={sendChat}>Send message</button>
                    <button className="ghost" onClick={loadInbox}>Refresh inbox</button>
                  </div>
                </div>
              )}
            </section>
          )}

          {me?.role !== "admin" && (
            <section className="card">
              <h2>Appointment Control</h2>
              <div className="grid">
                <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Appointment topic" />
                <input value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} type="date" />
                <input value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} type="time" />
              </div>
              <div className="row">
                {me?.role === "client" && <button onClick={createAppointment}>Create request</button>}
                <button className="ghost" onClick={loadAppointments}>Refresh appointments</button>
                {me?.role === "client" && selectedAppointment?.status === "PENDING_ADMIN_REVIEW" && (
                  <button onClick={requestReschedule}>Request reschedule</button>
                )}
                {me?.role === "superuser" && selectedAppointment && selectedAppointment.superuserId === me.id && (
                  <>
                    <button onClick={() => respondAsSuperuser(true)}>Accept</button>
                    <button className="danger" onClick={() => respondAsSuperuser(false)}>Reject</button>
                  </>
                )}
              </div>
            </section>
          )}

          <section className="card">
            <h2>Appointments ({appointments.length})</h2>
            <div className="stack">
              {appointments.map((item) => (
                <button
                  key={item.id}
                  className={`appointment-item ${selectedAppointmentId === item.id ? "selected" : ""}`}
                  onClick={() => setSelectedAppointmentId(item.id)}
                >
                  <strong>{item.topic}</strong>
                  <span>{item.status}</span>
                  <span>
                    {"rank" in (item.superuser || {})
                      ? `${(item.superuser as SuperuserPublic).rank || "N/A"} | ${((item.superuser as SuperuserPublic).specializations || []).join(", ")}`
                      : "Superuser hidden"}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {me?.role === "client" && selectedAppointment && (
            <section className="card">
              <h2>DeepSeek Dialogue</h2>
              <textarea
                value={deepseekPrompt}
                onChange={(e) => setDeepseekPrompt(e.target.value)}
                rows={5}
                placeholder="Explain what you want to discuss..."
              />
              <div className="row">
                <button onClick={generateDeepseekSummary}>Generate README.md + PDF</button>
              </div>
              <pre>{aiOutput || "No AI output yet."}</pre>
            </section>
          )}

          {me?.role === "superuser" && selectedAppointment && selectedAppointment.superuserId === me.id && (
            <section className="card">
              <h2>Superuser actions</h2>
              <p className="muted">You can confirm or reject appointments assigned to you.</p>
              <div className="row">
                <button onClick={() => respondAsSuperuser(true)}>Accept selected</button>
                <button className="danger" onClick={() => respondAsSuperuser(false)}>Reject selected</button>
              </div>
            </section>
          )}

          <section className="card">
            <h2>Realtime Chat + Offline Inbox</h2>
            <textarea value={chatBody} onChange={(e) => setChatBody(e.target.value)} rows={3} placeholder="Type message" />
            <div className="row">
              <button onClick={sendChat}>Send message</button>
              <button className="ghost" onClick={loadInbox}>Refresh inbox</button>
            </div>
            <div className="stack inbox">
              {inbox.map((m) => (
                <div key={m.id} className="inbox-item">
                  <div>{m.body}</div>
                  <small>
                    {m.createdAt} | from: {m.fromUserId} | {m.readAt ? "read" : "unread"}
                  </small>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <footer className="status">{status}</footer>
    </div>
  );
}
