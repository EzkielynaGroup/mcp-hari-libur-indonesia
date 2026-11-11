# Publish notes: mcp-hari-libur-indonesia

**GitHub description** (<= 120 chars):
MCP server: Indonesian public holidays + cuti bersama 2025-2027 (SKB 3 Menteri) and working-day / SLA math. Offline.

**Topics**: mcp, model-context-protocol, mcp-server, indonesia, public-holidays, hari-libur, cuti-bersama, working-days, business-days, sla, claude, cursor, opencode

**Homepage**: https://www.npmjs.com/package/mcp-hari-libur-indonesia

**Owner actions before/after publishing**
1. Create `EzkielynaGroup/mcp-hari-libur-indonesia` (public), push `main`.
2. `npm publish` (name was free on npm on 11 Nov 2026; re-check with `npm view mcp-hari-libur-indonesia` right before publishing).
3. Publish `server.json` to the MCP registry with `mcp-publisher` (namespace `io.github.EzkielynaGroup`).
4. Yearly upkeep: when the SKB for 2028 appears (usually Sep-Oct 2027), add a year block + test counts and release 1.1.0.
   Also watch for amendments (2025 had one: cuti bersama 18 Aug 2025) and for isbat results that move Eid dates in 2027.
