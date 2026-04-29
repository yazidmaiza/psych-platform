import React, { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { api } from '../services/api';

const SEVERITY_CONFIG = {
  low: {
    bg: 'rgba(234, 179, 8, 0.12)',
    border: 'rgba(234, 179, 8, 0.4)',
    badge: '#eab308',
    label: 'LOW',
    icon: '⚠️'
  },
  medium: {
    bg: 'rgba(249, 115, 22, 0.12)',
    border: 'rgba(249, 115, 22, 0.4)',
    badge: '#f97316',
    label: 'MEDIUM',
    icon: '🔶'
  },
  high: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.5)',
    badge: '#ef4444',
    label: 'HIGH',
    icon: '🚨'
  },
  critical: {
    bg: 'rgba(239, 68, 68, 0.2)',
    border: 'rgba(239, 68, 68, 0.8)',
    badge: '#dc2626',
    label: 'CRITICAL',
    icon: '🔴',
    pulse: true
  }
};

const CATEGORY_LABELS = {
  self_harm: 'Self-Harm Signal',
  suicidal_ideation: 'Suicidal Ideation',
  abuse_trauma: 'Abuse / Trauma Disclosure',
  crisis_escalation: 'Crisis Escalation'
};

let socketInstance = null;

export default function RiskAlertBanner() {
  const [toasts, setToasts] = useState([]);
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

  const acknowledge = useCallback(async (alertId, toastKey) => {
    // Optimistic dismiss
    setToasts(prev => prev.filter(t => t.key !== toastKey));
    try {
      await api.put(`/api/risk-alerts/${alertId}/acknowledge`, {});
    } catch (err) {
      console.error('[RiskAlertBanner] Acknowledge failed:', err.message);
    }
  }, []);

  // Connect Socket.IO and join psychologist room
  useEffect(() => {
    if (!psychologistId) return;

    if (!socketInstance) {
      socketInstance = io('http://localhost:5000', {
        auth: { token: localStorage.getItem('token') },
        transports: ['websocket']
      });
    }

    socketInstance.emit('join_psychologist_room', psychologistId);

    const handleRiskAlert = (payload) => {
      const key = `${payload.alertId}-${Date.now()}`;
      const cfg = SEVERITY_CONFIG[payload.severity] || SEVERITY_CONFIG.medium;

      setToasts(prev => [{ ...payload, key, cfg }, ...prev.slice(0, 4)]);

      // Auto-dismiss after 30s (except critical)
      if (payload.severity !== 'critical') {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.key !== key));
        }, 30000);
      }
    };

    socketInstance.on('risk_alert', handleRiskAlert);

    return () => {
      socketInstance.off('risk_alert', handleRiskAlert);
    };
  }, [psychologistId]);

  // Don't render anything if no pending toasts or not a psychologist
  if (!psychologistId || toasts.length === 0) return null;

  return (
    <div style={styles.container}>
      {toasts.map(toast => {
        const { cfg } = toast;
        return (
          <div
            key={toast.key}
            style={{
              ...styles.toast,
              background: cfg.bg,
              borderColor: cfg.border,
              animation: cfg.pulse ? 'riskPulse 1.5s ease-in-out infinite' : 'riskSlideIn 0.35s ease'
            }}
          >
            <div style={styles.toastHeader}>
              <span style={styles.toastIcon}>{cfg.icon}</span>
              <div style={styles.toastTitle}>
                <span style={{ ...styles.severityBadge, background: cfg.badge }}>
                  {cfg.label}
                </span>
                <span style={styles.categoryLabel}>
                  {CATEGORY_LABELS[toast.riskCategory] || toast.riskCategory}
                </span>
              </div>
              <button
                onClick={() => acknowledge(toast.alertId, toast.key)}
                style={styles.ackBtn}
                title="Acknowledge"
              >
                ✓ Ack
              </button>
            </div>

            {toast.triggerMessage && (
              <div style={styles.triggerMsg}>
                "{toast.triggerMessage.slice(0, 120)}{toast.triggerMessage.length > 120 ? '…' : ''}"
              </div>
            )}

            {toast.llmReasoning && (
              <div style={styles.reasoning}>
                🤖 {toast.llmReasoning}
              </div>
            )}

            <div style={styles.toastFooter}>
              <span style={styles.scoreLabel}>Score: {toast.riskScore}/100</span>
              <span style={styles.timeLabel}>{new Date(toast.timestamp).toLocaleTimeString()}</span>
              <a
                href={`/patient/${toast.patientId}`}
                style={styles.viewLink}
              >
                View Patient →
              </a>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes riskSlideIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes riskPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
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
    maxWidth: '380px',
    width: '100%',
    pointerEvents: 'none'
  },
  toast: {
    pointerEvents: 'all',
    border: '1px solid',
    borderRadius: '1rem',
    padding: '1rem',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.35)'
  },
  toastHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem'
  },
  toastIcon: {
    fontSize: '1.1rem',
    flexShrink: 0
  },
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
  categoryLabel: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#fff'
  },
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
  scoreLabel: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 600
  },
  timeLabel: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.4)',
    flex: 1
  },
  viewLink: {
    fontSize: '0.73rem',
    color: '#a5b4fc',
    fontWeight: 700,
    textDecoration: 'none'
  }
};
