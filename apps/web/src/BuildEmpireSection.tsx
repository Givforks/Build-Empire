import React, { useState } from "react";
import "./BuildEmpireSection.css";

const BuildEmpireSection: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <section className="empire-section">
      <button
        className="empire-toggle"
        onClick={() => setOpen(!open)}
      >
        {open ? "Hide Build‑Empire Identity" : "Show Build‑Empire Identity"}
      </button>

      {open && (
        <div className="empire-content">
          <h1 className="empire-title">Build‑Empire</h1>
          <p className="empire-tagline">Innovation · Integrity · Impact</p>

          <div className="empire-vision-mission">
            <div className="empire-card">
              <h2>🌍 Vision</h2>
              <p>
                To build an empire of innovation where technology, integrity, and
                collaboration converge — empowering enterprises, communities, and
                individuals to thrive in the digital age.
              </p>
            </div>
            <div className="empire-card">
              <h2>🎯 Mission</h2>
              <p>
                Our mission at Build‑Empire is to simplify technology for all —
                learned or not — by providing accessible platforms where clients
                can schedule appointments, explore tailored solutions, and
                leverage our expertise in software, hardware partnerships, and
                enterprise growth.
              </p>
            </div>
          </div>

          <div className="empire-values">
            <div className="value-card">
              <h3>🚀 Innovation</h3>
              <p>
                Deliver cutting‑edge software and integrate with hardware through
                trusted partners.
              </p>
            </div>
            <div className="value-card">
              <h3>🤝 Integrity</h3>
              <p>
                Uphold norms, ethics, and transparency in every engagement.
              </p>
            </div>
            <div className="value-card">
              <h3>🌍 Impact</h3>
              <p>
                Extend beyond software into security models, housing technologies,
                and football sporting management.
              </p>
            </div>
          </div>

          <footer className="empire-footer">
            <p>
              Build‑Empire — Bridging technology, enterprise growth, and human
              potential.
            </p>
          </footer>
        </div>
      )}
    </section>
  );
};

export default BuildEmpireSection;
