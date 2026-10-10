Product Requirements Document

1. Product idea

Aks is an AI agent that finds access debt: old, indirect, or ownerless permissions that look ordinary in individual systems but combine into a risky path to a sensitive resource.

A user asks a question or opens a finding—for example, “Can a former contractor still reach this repository or cloud account indirectly?” Aks traverses a graph across identity → group → role → repository/cloud resource → sensitive asset. It explains the risk using source evidence, proposes the smallest safe access change, and shows which path would disappear after that change. The MVP will not revoke permissions automatically. It will prepare an approval-ready ticket or pull request.

Core innovation: Aks does not stop at “a risky path exists.” Every remediation proposal includes before-and-after graph proof and a minimum-change rationale: which single relationship change can close the risky path, and which legitimate access paths would remain.

2. Problem and opportunity

Small engineering and security teams keep identities, groups, code repositories, cloud roles, ownership records, and audit events in separate tools. Inspecting one permission is straightforward. Understanding how inherited group membership, an automation identity, or a shared role ultimately provides access to a sensitive resource is not.

As a result, former contractor accounts, dormant service identities, stale group memberships, and unowned repositories can become hidden “access debt.” Analysts must correlate the data manually, while teams worry that removing a broad permission might interrupt legitimate work. Aks focuses on non-event risk: finding a latent access chain even when no active alert has fired, then preparing a safe cleanup proposal.

Graph-based security analysis and graph-grounded security agents are already established product directions. Microsoft describes security graphs as connecting users, devices, apps, assets, and their relationships; Wiz describes agents grounded in a security graph for investigation and remediation . Aks should therefore not be positioned as “another attack-path copilot.” Its narrower product wedge is stale or ownerless access debt + least-change proposal + verifiable before-and-after proof.

This is a product differentiation hypothesis, not a claim of legal or patent novelty. MVP user testing should establish whether this proof is useful and trustworthy in real access-review workflows.

3. Target users

Primary user — Small-team security engineer: Owns access reviews and security findings at a SaaS or developer-tools company with 5–50 engineers. They need explainable access paths without becoming a dedicated graph analyst.

Secondary user — Platform / DevOps engineer: Maintains repositories, cloud roles, and service identities. They need changes that do not cause unplanned outages.

Approver — Engineering manager or system owner: Confirms the business impact of a proposed change. They need a concise evidence trail, a named owner, and a rollback hint.

4. Jobs to be done

•
“Tell me whether a dormant or departed identity can still reach a sensitive repository or cloud asset.”

•
“Show the complete, timestamped relationship path behind the finding—not just the model’s verdict.”

•
“Suggest the least disruptive change and show that it actually breaks the risky path.”

•
“Do not change live permissions without my approval; route a proposal to the right owner.”

5. Product principles

1. The graph is the evidence layer; the LLM is the reasoning interface. Deterministic graph queries establish paths, reachability, and before-and-after results. The LLM summarizes and explains those results.

1. No evidence, no assertion. Every material statement must link to a graph node, edge, source record, and observation time.

1. Minimum change first. Prefer removing one stale membership or narrow role binding over deleting a broad group, if the smaller change closes the risky path.

1. Human approval for writes. The MVP is read-only by default. Creating a ticket or pull-request draft is allowed; revoking a live permission is out of scope.

1. Make uncertainty visible. Missing ownership, stale ingestion, and conflicting source data must be reported as unknown—not guessed with confidence.

1. MVP scope

In scope

•
One seeded demo environment: GitHub organization + synthetic identity/SSO export + AWS IAM-style role/resource export. The MVP may use fixture files or mocked connectors instead of real provider OAuth.

•
A canonical graph model for identities, groups, roles, repositories, cloud resources, sensitivity labels, owners, and access/audit events.

•
A narrow natural-language investigation domain: access paths from stale or dormant identities to sensitive GitHub repositories or cloud resources.

•
Bounded multi-hop investigation using graph queries and a small set of graph algorithms.

•
Risk explanation, source evidence, confidence/uncertainty, candidate remediation, and before-and-after verification.

•
An approval-ready Jira/GitHub issue draft or downloadable remediation plan. A write connector may be mocked in the demo.

•
Investigation audit trail and graph-path visualization.

Out of scope for the MVP

•
Live permission revocation through a production identity provider.

•
Arbitrary enterprise data ingestion, a universal connector marketplace, or support for every graph database.

•
Autonomous incident response, threat attribution, fraud detection, or production change execution.

•
Allowing an LLM to send free-form Cypher/SQL directly to production data.

•
Regulatory compliance certification or presenting a risk score as a definitive security verdict.

7. Core user journey

1. Connect or load data: The demo user loads sample exports. Aks preserves each record’s source and observed_at timestamp.

1. Ask a question or open a finding: The user asks, “Which inactive contractors can still reach a high-sensitivity repository?” or selects a flagged identity.

1. Plan the investigation: The agent converts the question into bounded intent: target sensitivity, identity state, lookback window, maximum path length, and evidence freshness.

1. Select tools through MCP: The agent discovers the graph schema and relevant graph-query tools, then fetches paths, membership age, last-seen events, and ownership evidence. MCP defines a standard tool-discovery and invocation flow .

1. Reason over paths: Graph reachability, shortest-path queries, and simple risk rules produce candidate chains. The agent may explain only chains present in the query results.

1. Propose a minimal fix: Candidate changes are simulated. Aks prefers a change that closes the risky path without cutting unrelated valid paths.

1. Show proof and request approval: The user sees before-and-after paths, the proposed diff, impact, source freshness, and a rollback hint. The user can approve, edit, dismiss, or route the proposal to an owner.

1. Verify the result: After a demo action, the graph is queried again. Aks reports verified, not verified, or unable to verify. Creating a ticket must never be presented as successful permission removal.

1. Example investigation

Prompt: “Nisha’s contract ended last month. Can her account still reach the production billing repository? If so, propose a safe fix.”

Graph evidence (synthetic demo data): Nisha → member_of: contractors-read → grants: repo-reader → can_read: billing-api; the HR export shows a contract end date 30 days ago; the identity export shows the last sign-in 41 days ago; and billing-api has the production-sensitive label. All values in this example come from demo fixtures, not production facts.

Aks result: “One access path found, four hops, high priority.” The agent displays the exact edges and each edge’s source. It proposes removing Nisha’s membership in contractors-read. A counterfactual query shows that Nisha’s path to the billing repository is broken while other active members retain their access paths. If the group owner or membership source is stale, Aks creates a “verify source” task instead of declaring removal safe.

9. Functional requirements

FR-1: Graph-backed identity and resource context

Every node and edge must store its source system, source record ID, observed_at, optional valid_from/valid_to, confidence/provenance, and tenant boundary. Duplicate identities may be linked using deterministic matching rules; ambiguous matches must not be auto-merged.

FR-2: Bounded multi-hop investigation

The agent must be able to set the target entity, relationship types, hop limit, time range, and sensitivity filter. The default maximum path length is six hops. Query results must include the path sequence and matched evidence IDs. Result caps and timeouts are mandatory.

FR-3: Algorithmic candidate generation

The MVP must include:

•
Reachability/path finding: Determine whether a valid access path exists from an identity to a sensitive resource.

•
Shortest/simplest path: Show a representative path an analyst can understand.

•
Candidate edge-removal simulation: Temporarily exclude a candidate relationship and check reachability again.

•
Staleness checks: Apply explicit thresholds to last-seen activity and source freshness.

Centrality and anomaly detection are not MVP requirements. The proof of concept is multi-hop path analysis plus remediation verification.

FR-4: MCP tool selection

The MCP server must expose tools with clear, narrow schemas, such as:

•
get_graph_schema

•
find_access_paths — identity, target, maximum hops, time window, and filters.

•
get_entity_evidence — source records and timestamps.

•
simulate_edge_removal — reachability after excluding a candidate edge ID.

•
create_remediation_draft — convert an approved proposal into a ticket/pull-request draft.

The LLM must not receive arbitrary query strings or unrestricted connector credentials. Read and write tools must use separate scopes. MCP security guidance calls for validating inputs, applying access controls and rate limits, logging tool use, and presenting confirmation before sensitive operations .

FR-5: Risk prioritization

MVP priority labels must be rules-based and explainable. Inputs may include resource sensitivity, identity status, path length/privilege, activity recency, owner availability, and evidence freshness. Each label must show its contributing factors. “High” must not be interpreted as confirmed compromise.

FR-6: Action draft and verification

Each proposal must include the target edge/change, affected identity/resource, rationale, expected access change, counterfactual result, and rollback/restore hint. The UI must display the proposed payload before the write connector creates it. An independent graph verification query must run after completion.

FR-7: Explainable investigation record

The record must include the user question, query plan, invoked tool names and sanitized inputs, returned evidence IDs, selected path, rejected alternative (if any), uncertainty, proposed action, approval decision, and verification result. Secrets and raw credentials must never be logged.

10. Non-functional requirements

•
On a demo dataset of up to 10,000 nodes and 50,000 edges, the p95 response target for a common query is under 10 seconds. This must be reported from a local benchmark and is not a guarantee.

•
Tenant data must be separated by namespace or an equivalent access boundary.

•
The UI must render a structured JSON result. Evidence-ID validation must reject explanations that cite fabricated entities or edges.

•
Tool timeouts, retry caps, result caps, query allowlists, and rate limits are required.

•
Source freshness must be visible with each result. A “no path” result from stale data must not be presented as definitive absence.

•
All write operations must use an idempotency key or duplicate check.

11. Explainability UI specification

The investigation view must show four things on its first screen:

1.  Verdict: “Path found,” “No path found,” or “Insufficient data.”

2.  Why: A three-to-six-line plain-language explanation, confidence, and material unknowns.

3.  Path: The node/edge chain with edge labels. Each edge must expose its source, record ID, and last-observed time.

4.  What changes if approved: Before-and-after path comparison, the proposed change, and expected unaffected access.

A “no path found” result must include data-coverage and freshness caveats. The UI must distinguish agent inference from source facts.

12. High-level architecture

Ingestion adapters → canonical graph + provenance store → graph query/algorithm service → MCP server → agent orchestrator → evidence validator → web UI / ticket draft.

•
Ingestion: Fixture loader for the MVP; a connector interface for future integrations.

•
Graph layer: Property graph or lightweight graph library; the prototype does not need to depend on a specific graph database vendor.

•
Query service: Pre-approved typed operations for graph traversal and candidate-removal simulation.

•
MCP server: Tool discovery and schema-validated invocation. Tools are read-only by default; draft creation is a separate write tool.

•
Agent orchestrator: Plans the question, selects tools, and synthesizes evidence; it cannot alter query results.

•
Evidence validator: Verifies referenced node/edge IDs and suppresses unsupported factual statements or converts them to uncertainty.

•
Action adapter: Issue/pull-request draft for the MVP; live identity-policy mutation is out of scope.

•
Audit store: Reproducible evidence and decision trail for every run.

Model selection is an implementation decision, not a PRD dependency. The MVP should support any tool-calling model that can provide structured tool inputs.

13. Success metrics and acceptance criteria

MVP demo acceptance:

•
At least 18 of 20 seeded benchmark cases return the correct risky path or “insufficient data.”

•
100% of displayed path edges resolve to real fixture graph records.

•
100% of remediation suggestions include before-and-after simulation output.

•
Zero live permission changes without explicit approval; live revocation must not be available in the MVP implementation.

•
Every answer to the 20 seeded questions shows source freshness and at least one traceable evidence reference.

•
An analyst can go from question to evidence and proposed fix within a three-minute demo.

Pilot learning metrics:

•
Time an analyst needs to understand and validate an investigation.

•
Owner acceptance, edit, and dismissal rate for suggested fixes.

•
False-path rate and incorrect “no path” rate caused by stale data.

•
Evidence coverage: the share of finding claims supported by traceable source records.

There is no baseline dataset yet, so the PRD does not promise a time-saving or incident-reduction percentage. A pilot must first measure a baseline.

14. Safety, privacy, and failure handling

•
Stale or conflicting data: Show a “data conflict” or “source is old” label. Block a risky write suggestion or create a human-verification task.

•
Ambiguous identity merge: Keep identities separate; return “uncertain” if the evidence is insufficient.

•
Prompt injection in imported text: Treat source text as untrusted data. It must not change system instructions or tool permissions.

•
Over-broad candidate fix: If impact simulation shows an unrelated path would break, reject the proposal, search for a narrower candidate, or request manual review.

•
Graph/query failure: Never present a partial failure as a complete investigation; show the failed source/tool clearly.

•
MCP/tool risk: Use allowlisted operations, schema validation, least privilege, confirmation before writes, and audit logs. MCP tools can be model-controlled through the protocol, so tool boundaries and the ability for a human to deny/confirm an operation are product requirements .

•
Sensitive data: Ingest only necessary attributes; exclude credentials, secrets, and tokens from the graph.

15. Demo plan (3–4 minutes)

1. Show a synthetic team graph containing a user, contractor group, repository, cloud role, and sensitive billing resource.

1. Ask an access-debt question.

1. Aks discovers/invokes MCP tools and traces a four-hop path; open an exact source and timestamp on screen.

1. Aks identifies one dormant membership and rejects a plausible but unsafe broad change.

1. Use before-and-after graph simulation to show that a narrow proposal closes the risky route without removing a valid peer’s access.

1. Select “Create review draft.” Aks creates a ticket/pull-request draft, not a live access change.

1. Show a final result with evidence IDs, confidence, and unknowns.

Seeded demo scenario: A deprovisioned contractor with stale nested-group membership, one high-sensitivity repository, one current employee with a valid access path, and one deliberately stale source record to demonstrate uncertainty handling.

16. Build plan

Phase 1 — Graph and fixtures: Canonical schema, synthetic dataset, provenance, and path-query API.

Phase 2 — MCP tools: Schema discovery, bounded path query, entity evidence, edge-removal simulation, strict validation, and audit logging.

Phase 3 — Agent + evidence UI: Question planner, tool selection, structured answer, path visualization, evidence links, and uncertainty states.

Phase 4 — Safe action draft: Rank minimum-change candidates, show a human-readable diff, create a mocked ticket/pull-request draft, and verify after drafting.

Each phase must end with a demoable checkpoint. Add real connectors only after the synthetic workflow passes evaluation.

17. Key risks and mitigations

•
Risk: stale permission data is unavailable. Make ingestion coverage and freshness first-class; do not silently assume an unsupported connector exists.

•
Risk: graph output is too complex. Show a representative shortest path and relevant evidence first; make the full neighborhood optional.

•
Risk: the LLM invents an unsafe action. Generate eligible actions through the deterministic simulator; let the model explain or route only those eligible options.

•
Risk: the project resembles existing security graph agents. Focus the demo on dormant/ownerless access debt, minimum-edge remediation, and before-and-after proof—not broad threat investigation.

•
Risk: clean demo data overstates real-world value. Include stale/contradictory fixtures and report acceptance criteria and limitations honestly.

18. Submission-ready pitch

Aks is a graph-grounded agent that finds access nobody remembers. It connects identities, groups, code repositories, cloud roles, owners, and activity into multi-hop access paths. Instead of returning another risk score, it shows the source-backed path, simulates the smallest proposed access change, and proves what the change would break—or preserve—before an owner approves a ticket or pull request. Its MVP focuses on one overlooked problem: stale and ownerless access that remains dangerous even when no alert fires.
