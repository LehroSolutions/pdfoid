# Open-source + Hosted Distribution Model

## Summary
PDFoid is an open-source PDF tool created and maintained by **Lehro Solutions**.

We operate two tracks:
- **Public (GitHub) track**: the open-source codebase intended for the community.
- **In-house track**: a private/internal variant used to test beta features before they are hardened and upstreamed.

This approach helps us ship safely, iterate quickly, and keep the public repo stable.

## What stays open-source
- The core editor, viewer, and annotation tooling
- Bug fixes, performance improvements, and security patches
- Most UX improvements and general-purpose capabilities

## What may exist only in the in-house track (temporarily)
- Experimental features that are not yet stable
- Risky refactors under evaluation
- Feature-flagged prototypes that require additional validation

Rule of thumb: if it is stable and broadly useful, it should be upstreamed.

## Upstreaming policy
- Prefer small, reviewable pull requests.
- Avoid introducing hidden dependencies on private services.
- Write an ADR when a change affects architecture, persistence, or file formats.

## Compatibility expectations
- Public releases should not silently break saved annotations or exported PDFs.
- If a breaking change is unavoidable, document a migration plan.

## License
See [LICENSE](../LICENSE). The project uses a permissive license so the public codebase can be used broadly, while Lehro Solutions can still run and host a maintained version.
