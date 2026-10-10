'use client';

import React, { useState, useEffect } from 'react';
import { InvestigationResult } from '../agent/types';
import { RemediationDraft } from '../mcp/types';
import { ScenarioDefinition } from '../core/types';

export default function AksConsolePage() {
  const [queryText, setQueryText] = useState(
    "Nisha's contract ended last month. Can her account still reach billing-api? If so, propose a safe fix."
  );
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('scenario_1_departed_contractor');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Draft Modal State
  const [draftModalOpen, setDraftModalOpen] = useState<boolean>(false);
  const [draftLoading, setDraftLoading] = useState<boolean>(false);
  const [draftData, setDraftData] = useState<RemediationDraft | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Audit Trace Toggle
  const [showAuditTrace, setShowAuditTrace] = useState<boolean>(false);

  // Load scenarios on mount and run initial investigation
  useEffect(() => {
    fetchScenarios();
  }, []);

  const fetchScenarios = async () => {
    try {
      const res = await fetch('/api/scenarios');
      if (res.ok) {
        const data = await res.json();
        setScenarios(data);
      }
    } catch {
      // Fallback if offline
    }
    // Run default investigation on mount
    runInvestigation(
      "Nisha's contract ended last month. Can her account still reach billing-api? If so, propose a safe fix.",
      'usr_nisha_patel',
      'repo_billing_api'
    );
  };

  const handleSelectScenario = (sc: ScenarioDefinition) => {
    setSelectedScenarioId(sc.id);
    setQueryText(sc.question);
    runInvestigation(sc.question, sc.subject_id, sc.target_id);
  };

  const runInvestigation = async (question: string, subjectId?: string, targetId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          subject_id: subjectId,
          target_id: targetId,
          max_hops: 6,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to complete investigation');
      }

      const data: InvestigationResult = await res.json();
      setResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDraft = async () => {
    if (!result?.recommended_remediation) return;
    setDraftLoading(true);
    setDraftModalOpen(true);
    try {
      const rem = result.recommended_remediation;
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_edge_id: rem.edge.id,
          proposed_action: rem.action_description,
          rationale: rem.rationale,
          affected_identity: result.paths[0]?.nodes[0]?.name || 'identity',
          affected_resource: result.paths[0]?.nodes[result.paths[0].nodes.length - 1]?.name || 'resource',
          rollback_hint: rem.rollback_hint,
          idempotency_key: `idemp_draft_${rem.edge.id}_${Date.now()}`,
          draft_type: 'github_pr',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create draft');
      }

      const draft: RemediationDraft = await res.json();
      setDraftData(draft);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setDraftLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (draftData?.body_markdown) {
      navigator.clipboard.writeText(draftData.body_markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">A</div>
          <div className="brand-text">
            <h1>
              Aks <span style={{ fontSize: 13, color: '#38bdf8', fontWeight: 500 }}>v0.1</span>
            </h1>
            <p className="brand-tagline">
              Explainable Graph-Grounded Access Debt Agent & Counterfactual Simulator
            </p>
          </div>
        </div>
        <div className="header-badges">
          <div className="protocol-badge">
            <span className="pulse-indicator"></span>
            MCP Protocol Active
          </div>
          <div className="protocol-badge" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34d399' }}>
            Zero Mutation Sandbox
          </div>
        </div>
      </header>

      {/* Demo Scenario Quick-Selector */}
      <section className="scenario-bar">
        <div className="scenario-title">Seeded Demo Benchmark Scenarios</div>
        <div className="scenario-chips">
          {scenarios.map((sc) => (
            <button
              key={sc.id}
              className={`scenario-chip ${selectedScenarioId === sc.id ? 'active' : ''}`}
              onClick={() => handleSelectScenario(sc)}
            >
              <span>{sc.id.includes('departed') ? '🚨' : sc.id.includes('employee') ? '🛡️' : sc.id.includes('conflict') ? '⚠️' : '✅'}</span>
              <span>{sc.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Investigation Query Bar */}
      <section className="query-box">
        <div className="query-input-wrap">
          <input
            type="text"
            className="query-input"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Ask about access debt (e.g. Can Nisha Patel still reach billing-api?)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') runInvestigation(queryText);
            }}
          />
        </div>
        <button
          className="investigate-btn"
          onClick={() => runInvestigation(queryText)}
          disabled={loading}
        >
          {loading ? 'Traversing Graph...' : 'Investigate Access'}
        </button>
      </section>

      {error && (
        <div className="uncertainty-box" style={{ borderColor: 'rgba(244, 63, 94, 0.4)', background: 'rgba(244, 63, 94, 0.1)' }}>
          <div className="uncertainty-icon">⚠️</div>
          <div className="uncertainty-text">
            <h4 style={{ color: '#f43f5e' }}>Investigation Error</h4>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* 4-Screen Investigation Result Grid */}
      {result && (
        <div className="investigation-grid">
          {/* Section 1 & 2: Verdict & Why Card */}
          <div className={`verdict-card ${result.verdict_badge}`}>
            <div className="verdict-header">
              <div className="verdict-meta">
                <span className={`verdict-badge ${result.verdict_badge}`}>
                  {result.verdict_badge === 'HIGH_RISK_PATH' && '🚨 RISKY ACCESS PATH FOUND'}
                  {result.verdict_badge === 'LEGITIMATE_ACCESS' && '🛡️ LEGITIMATE ACCESS VERIFIED'}
                  {result.verdict_badge === 'INSUFFICIENT_DATA' && '⚠️ INSUFFICIENT DATA / VERIFY SOURCE'}
                  {result.verdict_badge === 'SAFE_NO_PATH' && '✅ NO ACCESS PATH (FRESH PROOF)'}
                </span>
                <span className="verdict-question">&ldquo;{result.question}&rdquo;</span>
              </div>
              <div className="priority-pill">
                <div>
                  <div
                    className="priority-score"
                    style={{
                      color:
                        result.priority.level === 'CRITICAL'
                          ? '#f43f5e'
                          : result.priority.level === 'HIGH'
                          ? '#fb923c'
                          : result.priority.level === 'MEDIUM'
                          ? '#facc15'
                          : '#34d399',
                    }}
                  >
                    {result.priority.score}/100
                  </div>
                  <div className="priority-label">{result.priority.level} PRIORITY</div>
                </div>
              </div>
            </div>

            {/* Plain-Language Why Section */}
            <div className="why-section">
              <div className="why-title">Plain-Language Rationale (Why)</div>
              <p className="why-body">{result.summary_explanation}</p>
            </div>

            {/* Priority Contributing Factors */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b', fontWeight: 600, letterSpacing: 0.5 }}>
                Explainable Risk Factors
              </div>
              <div className="priority-factors-container">
                {result.priority.factors.map((f, i) => (
                  <div key={i} className="factor-chip" title={f.description}>
                    <span className="factor-points">+{f.points}</span>
                    <span>{f.factor}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Uncertainty Callouts */}
            {result.uncertainty_notes.length > 0 && (
              <div className="uncertainty-box">
                <div className="uncertainty-icon">⚠️</div>
                <div className="uncertainty-text">
                  <h4>Uncertainty & Source Discrepancies</h4>
                  {result.uncertainty_notes.map((note, i) => (
                    <p key={i}>{note}</p>
                  ))}
                  <p style={{ marginTop: 6, fontSize: 12, color: '#facc15' }}>
                    Remediation action is blocked until source systems are synchronized.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Interactive Path Flow Chain */}
          {result.paths.length > 0 ? (
            <div className="path-container">
              <div className="section-heading">
                <h2>
                  <span>🔗</span> Graph Path Evidence Chain
                </h2>
                <span className="hops-badge">
                  {result.paths[0].hop_count} Multi-Hop Hops Across Graph
                </span>
              </div>

              {result.paths.map((path) => (
                <div key={path.path_id} className="graph-path-flow">
                  {path.nodes.map((node, idx) => {
                    const edgeToNext = path.edges[idx];
                    return (
                      <React.Fragment key={node.id}>
                        <div className={`node-card ${node.type}`}>
                          <span className="node-type-label">{node.type}</span>
                          <span className="node-name" title={node.name}>
                            {node.name}
                          </span>
                          <span className="node-meta">
                            {node.sensitivity ? `Sensitivity: ${node.sensitivity}` : node.status ? `Status: ${node.status}` : node.id}
                          </span>
                        </div>

                        {edgeToNext && (
                          <div className="edge-connector">
                            <span className="edge-label">{edgeToNext.type}</span>
                            <div className="edge-arrow"></div>
                            <span className="edge-provenance">
                              {edgeToNext.source_system.toUpperCase()} • {edgeToNext.observed_at.split('T')[0]}
                            </span>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="path-container" style={{ textAlign: 'center', padding: '36px 20px' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🛡️</div>
              <h3 style={{ color: '#fff', fontSize: 16, marginBottom: 6 }}>No Graph Path Exists</h3>
              <p style={{ color: '#94a3b8', fontSize: 13, maxWidth: 500, margin: '0 auto' }}>
                Bounded graph traversal traversed all outbound edges up to 6 hops. Data verified fresh (
                {result.freshness.summary}) certifying definitive absence of access debt.
              </p>
            </div>
          )}

          {/* Section 4: What Changes If Approved (Simulation Diff) */}
          {result.simulation && (
            <div className="simulation-container">
              <div className="section-heading">
                <h2>
                  <span>🧪</span> Counterfactual Simulation (What Changes If Approved)
                </h2>
                <span
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: result.simulation.is_safe_remediation ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                    color: result.simulation.is_safe_remediation ? '#34d399' : '#fb7185',
                    border: `1px solid ${result.simulation.is_safe_remediation ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                  }}
                >
                  {result.simulation.is_safe_remediation ? 'Safe Minimum Change Verified' : 'Unsafe Change Detected'}
                </span>
              </div>

              <div className="sim-grid">
                {/* Before Panel */}
                <div className="sim-panel before">
                  <div className="sim-panel-title">
                    <span>Active State (Before)</span>
                    <span style={{ color: '#f43f5e' }}>Path Active</span>
                  </div>
                  <div className="sim-metric">
                    <span>Departed Identity Access:</span>
                    <span className="sim-metric-val" style={{ color: '#f43f5e' }}>
                      1 Unbroken Path
                    </span>
                  </div>
                  <div className="sim-metric">
                    <span>Target Sensitive Resource:</span>
                    <span className="sim-metric-val">{result.simulation.target_name}</span>
                  </div>
                  <div className="sim-metric">
                    <span>Active Peer Access (Alex):</span>
                    <span className="sim-metric-val">1 Active Path</span>
                  </div>
                </div>

                {/* After Panel */}
                <div className="sim-panel after">
                  <div className="sim-panel-title">
                    <span>Simulated State (After Proposed Fix)</span>
                    <span style={{ color: '#10b981' }}>Path Severed</span>
                  </div>
                  <div className="sim-metric">
                    <span>Departed Identity Access:</span>
                    <span className="sim-metric-val broken">0 Paths (Severed)</span>
                  </div>
                  <div className="sim-metric">
                    <span>Target Sensitive Resource:</span>
                    <span className="sim-metric-val" style={{ color: '#10b981' }}>
                      Protected
                    </span>
                  </div>
                  <div className="sim-metric">
                    <span>Active Peer Access (Alex):</span>
                    <span className="sim-metric-val retained">1 Path Retained (100%)</span>
                  </div>
                </div>
              </div>

              {/* Remediation Action Proposal */}
              {result.recommended_remediation && (
                <div className="remediation-action-bar">
                  <div className="action-text">
                    <h4>Proposed Fix: {result.recommended_remediation.action_description}</h4>
                    <p>{result.recommended_remediation.rationale}</p>
                  </div>
                  <button className="draft-button" onClick={handleCreateDraft}>
                    <span>📝</span>
                    <span>Create Review Draft</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MCP Tool Protocol Trace Timeline */}
          <section className="timeline-section">
            <button
              className="timeline-toggle"
              onClick={() => setShowAuditTrace(!showAuditTrace)}
            >
              <span>{showAuditTrace ? '▼' : '▶'}</span>
              <span>MCP Protocol Execution Audit Trace ({result.tool_traces.length} tool calls)</span>
            </button>

            {showAuditTrace && (
              <div className="timeline-drawer">
                <div style={{ color: '#94a3b8', marginBottom: 10, fontSize: 11 }}>
                  All model and orchestrator actions are strictly bounded through schema-validated MCP tool calls:
                </div>
                {result.tool_traces.map((trace) => (
                  <div key={trace.id} className="timeline-item">
                    <div>
                      <span className="timeline-tool">{trace.tool_name}</span>
                      <span style={{ color: '#64748b', marginLeft: 8 }}>[{trace.scope.toUpperCase()}]</span>
                    </div>
                    <div className="timeline-meta">
                      <span>Status: <span style={{ color: trace.status === 'success' ? '#34d399' : '#fb7185' }}>{trace.status}</span></span>
                      <span>{trace.duration_ms}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Remediation Draft Modal */}
      {draftModalOpen && (
        <div className="modal-overlay" onClick={() => setDraftModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <h3>
                  <span>📋</span> Approval-Ready Remediation Draft
                </h3>
              </div>
              <button className="modal-close-btn" onClick={() => setDraftModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="draft-notice-banner">
              ⚠️ <strong>DRAFT ONLY</strong>: This is a generated proposal for approval routing.
              <strong> Zero live permissions have been modified.</strong>
            </div>

            {draftLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                Invoking MCP tool <code>create_remediation_draft</code>...
              </div>
            ) : draftData ? (
              <>
                <pre className="draft-code-view">{draftData.body_markdown}</pre>
                <div className="modal-footer">
                  <button className="copy-btn" onClick={copyToClipboard}>
                    {copied ? '✓ Copied Markdown' : 'Copy Draft Payload'}
                  </button>
                  <button
                    className="draft-button"
                    style={{ background: '#1e293b' }}
                    onClick={() => setDraftModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
