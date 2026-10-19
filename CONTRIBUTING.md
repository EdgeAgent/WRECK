# Contributing to WRECK

WRECK is a framework assembled from two separately licensed upstream projects plus a small WRECK-owned orchestration layer. Before changing files, identify whether the change belongs in `src/`, `test/`, `docs/`, or an upstream tree.

## Development

Use Node.js 20+ at the repository root. Run `npm run check` before submitting WRECK-owned changes. The check is local-only and does not install dependencies or contact a target.

## Upstream source

The code under `packages/rea/` and `apps/website-cloner/` is vendored upstream source. Preserve its own license/attribution and do not silently present upstream changes as original WRECK work. When refreshing a snapshot, update `THIRD_PARTY_NOTICES.md` with the exact commit SHA and rerun the WRECK checks. Follow each upstream project's contribution and security policies for changes intended for that project.

## Integration quality bar

New WRECK features should keep evidence traceable, avoid persisting secrets, respect explicit target authorization, work across supported coding agents where possible, and state limitations rather than pretending that unavailable evidence exists.
