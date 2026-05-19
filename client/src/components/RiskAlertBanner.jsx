import React, { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { api } from '../services/api';

const SEVERITY_CONFIG = {
  low: {
    bg: 'rgba(234, 179, 8, 0.12)',
    border: 'rgba(234, 179, 8, 0.4)',
    badge: '#eab308',
    label: 'LOW',
    icon: '⚠️',
    iconLabel: 'Warning'
  },
  medium: {
    bg: 'rgba(249, 115, 22, 0.12)',
    border: 'rgba(249, 115, 22, 0.4)',
    badge: '#f97316',
    label: 'MEDIUM',
    icon: '🔶',
    iconLabel: 'Medium severity'
  },
  high: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.5)',
    badge: '#ef4444',
    label: 'HIGH',
    icon: '🚨',
    iconLabel: 'High severity'
  },
  critical: {
    bg: 'rgba(139, 0, 0, 0.25)',
    border: 'rgba(239, 68, 68, 0.9)',
    badge: '#dc2626',
    label: 'CRITICAL',
    icon: '🔴',
    iconLabel: 'Critical severity',
    pulse: true
  }
};

const CATEGORY_LABELS = {
  self_harm:        'Self-Harm Signal',
  suicidal_ideation:'Suicidal Ideation',
  abuse_trauma:     'Abuse / Trauma Disclosure',
  crisis_escalation:'Crisis Escalation'
};

let socketInstance = null;

export default function RiskAlertBanner() {
  const [toasts, setToasts]               = useState([]);
  const [psychologistId, setPsychologistId] = useState(null);

  // Identify psychologist from stored profile
  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) return;
    try {
      const user = JSON.parse(raw);
      if (user.role === 'psychologist') {
        setPsychologistId(user.id || user._id);
      }
    } catch {
      // not a psychologist
    }
  }, []);

  // Acknowledge — only available on non-CRITICAL toasts
  const acknowledge = useCallback(async (alertId, toastKey) => {
    setToasts(prev => prev.filter(t => t.key !== toastKey));
    try {
      await api.put(`/api/risk-alerts/${alertId}/acknowledge`, {});
    } catch (err) {
      console.error('[RiskAlertBanner] Acknowledge failed:', err.message);
    }
  }, []);

  // Connect Socket.IO and listen for both risk levels
  useEffect(() => {
    if (!psychologistId) return;

    if (!socketInstance) {
      socketInstance = io('http://localhost:5000', {
        auth: { token: localStorage.getItem('token') },
        transports: ['websocket']
      });
    }

    socketInstance.emit('join_psychologist_room', psychologistId);

    /**
     * Shared handler for both 'risk_alert' and 'crisis_alert' events.
     * forceCritical=true is passed for 'crisis_alert' so the toast always
     * gets the CRITICAL config regardless of what severity the payload carries.
     */
    const buildHandler = (forceCritical = false) => (payload) => {
      const key      = `${payload.alertId}-${Date.now()}`;
      const severity = forceCritical ? 'critical' : (payload.severity || 'medium');
      const cfg      = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.medium;

      const toast = {
        ...payload,
        key,
        cfg,
        severity,
        // Read flags sent by RiskAlertService for CRITICAL escalations
        requiresAck:   payload.requiresAck   || forceCritical,
        sessionPaused: payload.sessionPaused || forceCritical
      };

      // CRITICAL toasts go to the TOP and push others down;
      // standard toasts are capped at 4 in the stack
      setToasts(prev =>
        forceCritical
          ? [toast, ...prev]              // crisis always on top, no cap
          : [toast, ...prev.slice(0, 3)]  // standard: max 4 total
      );

      // Auto-dismiss after 30s ONLY for non-critical, non-requiresAck toasts
      if (!toast.requiresAck) {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.key !== key));
        }, 30000);
      }
      // CRITICAL / requiresAck toasts stay until the psychologist navigates
      // to the patient page or manually dismisses from that page
    };

    const handleRiskAlert   = buildHandler(false);
    const handleCrisisAlert = buildHandler(true);

    socketInstance.on('risk_alert',   handleRiskAlert);
    socketInstance.on('crisis_alert', handleCrisisAlert);   // ← NEW

    return () => {
      socketInstance.off('risk_alert',   handleRiskAlert);
      socketInstance.off('crisis_alert', handleCrisisAlert);
    };
  }, [psychologistId]);

  if (!psychologistId || toasts.length === 0) return null;

  const crisisCount   = toasts.filter(t => t.requiresAck).length;
  const standardCount = toasts.length - crisisCount;
  const regionLabel   = crisisCount > 0
    ? `${crisisCount} crisis alert${crisisCount > 1 ? 's' : ''} requiring immediate attention` +
      (standardCount > 0 ? `, ${standardCount} standard alert${standardCount > 1 ? 's' : ''}` : '')
    : `Risk alerts — ${toasts.length} active`;

  return (
    <div
      style={styles.container}
      role="region"
      aria-label={regionLabel}
    >
      {toasts.map(toast => {
        const { cfg }        = toast;
        const categoryText   = CATEGORY_LABELS[toast.riskCategory] || toast.riskCategory;
        const isCritical     = toast.requiresAck;   // use requiresAck as the UX gate
        const isSessionPaused = toast.sessionPaused;

        const triggerId = `risk-trigger-${toast.key}`;
        const reasonId  = `risk-reason-${toast.key}`;

        return (
          <div
            key={toast.key}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            aria-label={
              isCritical
                ? `Crisis alert — patient session paused: ${categoryText}`
                : `${cfg.label} risk alert: ${categoryText}`
            }
            style={{
              ...styles.toast,
              ...(isCritical ? styles.toastCritical : {}),
              background:  cfg.bg,
              borderColor: cfg.border,
              animation: cfg.pulse
                ? 'riskPulse 1.5s ease-in-out infinite'
                : 'riskSlideIn 0.35s ease'
            }}
          >
            {/* ── Crisis banner strip ──────────────────────────────────
                Only shown on CRITICAL / requiresAck toasts.
                Full-width red strip at the top of the card.
            */}
            {isCritical && (
              <div style={styles.crisisBanner} role="status" aria-label="Session paused — immediate attention required">
                <span aria-hidden="true">🛑 </span>
                SESSION PAUSED — IMMEDIATE ATTENTION REQUIRED
              </div>
            )}

            <div style={styles.toastHeader}>
              <span style={styles.toastIcon} aria-hidden="true">{cfg.icon}</span>

              <div style={styles.toastTitle}>
                <span
                  style={{ ...styles.severityBadge, background: cfg.badge }}
                  aria-hidden="true"
                >
                  {cfg.label}
                </span>
                <span style={styles.categoryLabel}>{categoryText}</span>
              </div>

              {/*
                CRITICAL toasts: NO Ack button — the psychologist must
                navigate to the patient page to resolve. This forces
                deliberate review rather than dismissing from a toast.

                Standard toasts: Ack button available as before.
              */}
              {!isCritical && (
                <button
                  onClick={() => acknowledge(toast.alertId, toast.key)}
                  style={styles.ackBtn}
                  className="risk-ack-btn"
                  aria-label={`Acknowledge ${categoryText} alert`}
                >
                  <span aria-hidden="true">✓ Ack</span>
                </button>
              )}
            </div>

            {toast.triggerMessage && (
              <div
                id={triggerId}
                style={styles.triggerMsg}
                aria-label={`Patient message: ${toast.triggerMessage.slice(0, 120)}${toast.triggerMessage.length > 120 ? '…' : ''}`}
              >
                "{toast.triggerMessage.slice(0, 120)}{toast.triggerMessage.length > 120 ? '…' : ''}"
              </div>
            )}

            {toast.llmReasoning && (
              <div id={reasonId} style={styles.reasoning}>
                <span aria-hidden="true">🤖 </span>
                <span aria-label={`AI assessment: ${toast.llmReasoning}`}>
                  {toast.llmReasoning}
                </span>
              </div>
            )}

            <div style={styles.toastFooter}>
              <span
                style={styles.scoreLabel}
                aria-label={`Risk score: ${toast.riskScore} out of 100`}
              >
                Score: {toast.riskScore}/100
              </span>
              <time
                style={styles.timeLabel}
                dateTime={toast.timestamp}
                aria-label={`Alert received at ${new Date(toast.timestamp).toLocaleTimeString()}`}
              >
                {new Date(toast.timestamp).toLocaleTimeString()}
              </time>

              {/* View patient link — always present */}
              <a
                href={`/patient/${toast.patientId}`}
                style={styles.viewLink}
                className="risk-view-link"
                aria-label={
                  isCritical
                    ? `View patient profile and resolve crisis — ${categoryText}`
                    : `View patient profile — ${categoryText} alert`
                }
              >
                <span aria-hidden="true">
                  {isCritical ? 'Resolve →' : 'View Patient →'}
                </span>
              </a>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes riskSlideIn {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes riskPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
          50%       { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
        }
        .risk-ack-btn:focus-visible,
        .risk-view-link:focus-visible {
          outline: 2px solid #fff;
          outline-offset: 2px;
          border-radius: 4px;
        }
        @media (prefers-reduced-motion: reduce) {
          [role="alert"] { animation: none !important; }
        }
        @media (forced-colors: active) {
          [role="alert"] {
            border: 2px solid ButtonText !important;
            forced-color-adjust: none;
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: '1rem',
    right: '1rem',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxWidth: '400px',
    width: '100%',
    pointerEvents: 'none'
  },
  toast: {
    pointerEvents: 'all',
    border: '1px solid',
    borderRadius: '1rem',
    padding: '1rem',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
    overflow: 'hidden'
  },
  // Extra overrides applied on top of toast for CRITICAL
  toastCritical: {
    borderWidth: '2px',
    boxShadow: '0 0 0 2px rgba(239,68,68,0.4), 0 12px 40px rgba(0,0,0,0.5)'
  },
  // Full-width strip at top of CRITICAL toast
  crisisBanner: {
    margin: '-1rem -1rem 0.75rem -1rem',
    padding: '0.35rem 1rem',
    background: 'rgba(220, 38, 38, 0.85)',
    fontSize: '0.62rem',
    fontWeight: 900,
    letterSpacing: '0.1em',
    color: '#fff',
    textAlign: 'center'
  },
  toastHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem'
  },
  toastIcon: { fontSize: '1.1rem', flexShrink: 0 },
  toastTitle: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  severityBadge: {
    display: 'inline-block',
    color: '#fff',
    fontSize: '0.6rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  categoryLabel: { fontSize: '0.82rem', fontWeight: 700, color: '#fff' },
  ackBtn: {
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    borderRadius: '6px',
    padding: '3px 8px',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0
  },
  triggerMsg: {
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '0.5rem',
    padding: '0.4rem 0.6rem',
    fontSize: '0.78rem',
    color: 'rgba(255,255,255,0.75)',
    fontStyle: 'italic',
    marginBottom: '0.4rem',
    lineHeight: 1.4
  },
  reasoning: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '0.5rem',
    lineHeight: 1.4
  },
  toastFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginTop: '0.25rem'
  },
  scoreLabel: { fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 },
  timeLabel:  { fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', flex: 1 },
  viewLink: {
    fontSize: '0.73rem',
    color: '#a5b4fc',
    fontWeight: 700,
    textDecoration: 'none'
  }
};