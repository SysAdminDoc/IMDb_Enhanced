# IMDb Enhanced Roadmap

Status: consolidated on 2026-06-01 from the archived 2026-05-24 research
plan. Completed work is summarized in [COMPLETED.md](COMPLETED.md). Research
context lives in [RESEARCH_REPORT.md](RESEARCH_REPORT.md).

## Open Work

- [ ] **P3 - Publish to Greasy Fork.** The P0 connect whitelist and dead
  update URL cleanup are already complete. Before publishing, decide whether
  the grey-market default sites should stay enabled by default.
- [ ] **P3 - README, screenshots, and changelog.** Move user-facing release
  notes out of any gitignored local changelog and into tracked project docs.
- [ ] **P3 - Package/build single source of truth.** Add `package.json`, an
  esbuild or equivalent build step, and a single version source for the
  userscript metadata.

## Active Constraints

- Distribution is direct-file sharing until a real remote update channel
  exists.
- Live IMDb selector behavior still needs manual browser validation because
  non-browser fetches can hit bot verification.
- Keep the single-file userscript simple unless a build step is added as part
  of the P3 packaging item.
