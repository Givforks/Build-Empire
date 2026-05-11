import { useMemo, useState } from "react";

type PreferredDate = { date: string; timeSlots: string[] };
type Appointment = {
  id: string;
  topic: string;
  status: string;
  preferredDates: PreferredDate[];
  superuser?: { rank?: string; specializations?: string[] };
};

const API_BASE = "http://localhost:4000";

export default function App() {
  const [token, setToken] = useState<string>("");
  const [email, setEmail] = useState("client@example.com");
  const [password, setPassword] = useState("ClientPass123!");
  const [fullName, setFullName] = useState("Client Example");
  const [topic, setTopic] = useState("I need guidance for my upcoming strategic appointment.");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prompt, setPrompt] = useState("I need to discuss product direction, timeline, and expected outcomes.");
  const [aiOutput, setAiOutput] = useState("");
  const [message, setMessage] = useState("");

  const defaultPreferredDates = useMemo(
    () => [{ date: "2026-06-10", timeSlots: ["10:00"] }],
    []
  );

  async function signup() {
    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName, preferredDates: defaultPreferredDates })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error?.toString?.() || "Signup failed");
    setToken(data.token);
    setMessage("Signup successful.");
  }

  async function login() {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error?.toString?.() || "Login failed");
    setToken(data.token);
    setMessage("Login successful.");
  }

  async function createAppointment() {
    const res = await fetch(`${API_BASE}/api/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ topic, preferredDates: defaultPreferredDates })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error?.toString?.() || "Create appointment failed");
    setMessage(`Appointment created: ${data.id}`);
    await loadAppointments();
  }

  async function loadAppointments() {
    const res = await fetch(`${API_BASE}/api/appointments`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error?.toString?.() || "Load failed");
    setAppointments(data);
  }

  async function generateAi(appointmentId: string) {
    const res = await fetch(`${API_BASE}/api/ai/deepseek`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ appointmentId, prompt })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error?.toString?.() || "AI generation failed");
    setAiOutput(data.content);
    setMessage(`Saved as ${data.fileName}`);
  }

  return (
    <div className="page">
      <header>
        <h1>Build-Empire MVP</h1>
        <p>Client dashboard for appointment flow + AI summary attachment.</p>
      </header>

      <section className="card auth">
        <h2>Client Auth</h2>
        <div className="grid">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
        </div>
        <div className="row">
          <button onClick={signup}>Sign up</button>
          <button onClick={login}>Login</button>
        </div>
      </section>

      <section className="card">
        <h2>Create Appointment</h2>
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} />
        <div className="row">
          <button disabled={!token} onClick={createAppointment}>Create request</button>
          <button disabled={!token} onClick={loadAppointments}>Refresh appointments</button>
        </div>
      </section>

      <section className="card">
        <h2>Appointments</h2>
        {appointments.length === 0 ? <p>No appointments yet.</p> : null}
        {appointments.map((a) => (
          <article key={a.id} className="appointment">
            <h3>{a.topic}</h3>
            <p>Status: {a.status}</p>
            <p>
              Superuser view for client: <strong>{a.superuser?.rank || "N/A"}</strong> | {a.superuser?.specializations?.join(", ")}
            </p>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
            <button disabled={!token} onClick={() => generateAi(a.id)}>Generate README.md</button>
          </article>
        ))}
      </section>

      <section className="card">
        <h2>AI Output (README.md)</h2>
        <pre>{aiOutput || "No generated summary yet."}</pre>
      </section>

      <footer>{message}</footer>
    </div>
  );
}