import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";

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
  const [mode, setMode] = useState<"client" | "admin">("client");
  const [token, setToken] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState("Ready");

  const [email, setEmail] = useState("client@example.com");
  const [password, setPassword] = useState("ClientPass123!");
  const [fullName, setFullName] = useState("Client Example");
  const [state, setState] = useState("Lagos");

  const [adminUsername, setAdminUsername] = useState("GivenchiCodes");
  const [adminPassword, setAdminPassword] = useState("Givenchi1@@@@@");

  const [topic, setTopic] = useState("I need strategic guidance for my product and launch timeline.");
  const [preferredDate, setPreferredDate] = useState("2026-06-15");
  const [preferredTime, setPreferredTime] = useState("10:00");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [superusers, setSuperusers] = useState<Superuser[]>([]);
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
      setStatus(`Signed up as ${user.fullName || user.email}`);
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
      setStatus(`Client login successful (${user.email})`);
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
      setStatus(`Admin login successful (${user.username})`);
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

  async function loadSuperusers() {
    if (!token || me?.role !== "admin") return;
    try {
      const rows = await api<Superuser[]>("/api/admin/superusers", token);
      setSuperusers(rows);
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
      await loadSuperusers();
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
    void loadSuperusers();
  }, [token, me]);

  useEffect(() => {
    if (!socket || !me) return;
    socket.emit("auth:bind", me.id);
  }, [socket, me]);

  return (
    <div className="page">
      <header className="hero">
        <h1>Build-Empire Production MVP</h1>
        <p>Appointments, admin mediation, DeepSeek summary output, offline inbox, and operator controls.</p>
        <div className="mode-tabs">
          <button className={mode === "client" ? "active" : ""} onClick={() => setMode("client")}>Client Mode</button>
          <button className={mode === "admin" ? "active" : ""} onClick={() => setMode("admin")}>Admin Mode</button>
        </div>
      </header>

      {mode === "client" && (
        <section className="card">
          <h2>Client Access</h2>
          <div className="grid">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
            <input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" />
          </div>
          <div className="row">
            <button onClick={signupClient}>Sign up</button>
            <button onClick={loginClient}>Login</button>
          </div>
        </section>
      )}

      {mode === "admin" && (
        <section className="card">
          <h2>Admin Access</h2>
          <div className="grid">
            <input value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="Admin username" />
            <input value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Admin password" type="password" />
          </div>
          <div className="row">
            <button onClick={loginAdmin}>Admin login</button>
          </div>
        </section>
      )}

      {token && me && (
        <>
          <section className="card">
            <h2>Appointment Control</h2>
            <div className="grid">
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Appointment topic" />
              <input value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} type="date" />
              <input value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} type="time" />
            </div>
            <div className="row">
              {me.role === "client" && <button onClick={createAppointment}>Create request</button>}
              <button onClick={loadAppointments}>Refresh appointments</button>
              {me.role === "client" && selectedAppointment?.status === "PENDING_ADMIN_REVIEW" && (
                <button onClick={requestReschedule}>Request reschedule</button>
              )}
            </div>
          </section>

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

          {me.role === "client" && selectedAppointment && (
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

          {me.role === "admin" && (
            <section className="card">
              <h2>Superuser Management</h2>
              <div className="grid">
                <input value={newSuperuserName} onChange={(e) => setNewSuperuserName(e.target.value)} placeholder="Name" />
                <input value={newSuperuserEmail} onChange={(e) => setNewSuperuserEmail(e.target.value)} placeholder="Email" />
                <input value={newSuperuserPassword} onChange={(e) => setNewSuperuserPassword(e.target.value)} placeholder="Password" type="password" />
                <input value={newSuperuserRank} onChange={(e) => setNewSuperuserRank(e.target.value)} placeholder="Rank" />
                <input value={newSuperuserSpecs} onChange={(e) => setNewSuperuserSpecs(e.target.value)} placeholder="Specializations comma-separated" />
              </div>
              <div className="row">
                <button onClick={createSuperuser}>Create superuser</button>
                <button onClick={loadSuperusers}>Refresh superusers</button>
              </div>
              <ul>
                {superusers.map((s) => (
                  <li key={s.id}>
                    {s.fullName} - {s.rank} ({(s.specializations || []).join(", ")})
                    <div className="row compact">
                      {selectedAppointment && <button onClick={() => forwardToSuperuser(s.id)}>Forward selected appointment</button>}
                      {selectedAppointment && <button onClick={() => sendSummaryEmail(s.id)}>Email summary</button>}
                    </div>
                  </li>
                ))}
              </ul>
              {selectedAppointment && (
                <div className="row">
                  <button onClick={() => decideAppointment("APPROVED")}>Approve selected</button>
                  <button onClick={() => decideAppointment("REJECTED")}>Reject selected</button>
                </div>
              )}
            </section>
          )}

          <section className="card">
            <h2>Realtime Chat + Offline Inbox</h2>
            <textarea value={chatBody} onChange={(e) => setChatBody(e.target.value)} rows={3} placeholder="Type message" />
            <div className="row">
              <button onClick={sendChat}>Send message</button>
              <button onClick={loadInbox}>Refresh inbox</button>
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
