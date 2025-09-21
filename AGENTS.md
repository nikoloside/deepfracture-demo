# Repository Guidelines

## Project Structure & Module Organization
This Vite app is purely front-end. Components and hooks live in `src/`, with `App.tsx` handling demo panels and `main.tsx` bootstrapping React through `index.html`. Keep global resets in `index.css`, component styles beside the view (`App.css`), and reusable logic in `src/lib/`. Drop mock payloads in `src/mocks/` and static assets in `public/`. Tooling sits at the root: `vite.config.ts` for builds, `vitest.config.ts` plus `vitest.setup.ts` for tests, and `eslint.config.js` for lint rules. Havok’s runtime ships in `public/havok/HavokPhysics.wasm`; refresh it when bumping `@babylonjs/havok`.

## Build, Test, and Development Commands
- `npm install` – install or refresh dependencies.
- `npm run dev` – start Vite on port 5173 with hot reload.
- `npm run test` – execute Vitest (jsdom, Testing Library) via the shared setup file.
- `npm run lint` – run the flat ESLint config across all TypeScript sources.
- `npm run build` – perform type checks and create a production bundle.
- `npm run preview` – serve the built assets on port 4173.

## Coding Style & Naming Conventions
Write modern React function components with strict TypeScript. Components use PascalCase, hooks start with `use`, utilities stay camelCase. Type props and state with explicit interfaces or `type` aliases. Follow the default Prettier formatting and class naming `component__element`. Keep JSX lean; push data shaping into helpers under `src/lib/`.

## Testing Guidelines
Tests live next to the code they cover, named `*.test.tsx`. Use Vitest with Testing Library helpers (`render`, `screen`) and matchers from `@testing-library/jest-dom`. Model fixtures or API stubs via `src/mocks/` and `vi.fn()` to avoid real network calls. Add both happy-path and boundary assertions before review.

## Commit & Pull Request Guidelines
Use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`) with short, imperative summaries. Keep each commit focused and rebase before opening a PR. Describe the problem, solution, and validation (`npm run test`, screenshots, gifs) in the PR body, and link issues with `Fixes #id` or `Refs #id`.

## Environment & Data Hygiene
Document every environment flag in `.env.example` and access it via `import.meta.env`. Never commit real credentials or patient data. Heavy assets belong in the shared artifact bucket—reference download steps in the README when they are required locally.
