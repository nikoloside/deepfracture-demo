# Repository Guidelines

## Project Structure & Module Organization
Keep all React components and hooks under `src/`; demo panels live in `App.tsx` and the entry point stays in `main.tsx` with `index.html`. Store shared helpers in `src/lib/`, UI styles beside their components (`App.css`), and global resets in `index.css`. Place test files next to the code they verify, and drop mock payloads in `src/mocks/`. Static assets (icons, wasm) belong in `public/`, including Havok’s runtime under `public/havok/`.

## Build, Test, and Development Commands
Use `npm install` to sync dependencies. Run `npm run dev` for the Vite dev server on port 5173, and `npm run preview` to inspect the production bundle locally. Execute `npm run build` to type check and generate the production output. Guard quality with `npm run test` (Vitest + Testing Library) and `npm run lint` for the flat ESLint config.

## Coding Style & Naming Conventions
Write modern React function components in strict TypeScript. Components use PascalCase, hooks start with `use`, and utilities remain camelCase. Co-locate CSS modules named `ComponentName.css` and favor `component__element` class patterns. Prettier formatting is the standard—run `npm run lint -- --fix` when needed. Avoid introducing non-ASCII characters unless already present.

## Testing Guidelines
Use Vitest with jsdom and Testing Library matchers from `@testing-library/jest-dom`. Name tests `ComponentName.test.tsx` beside their components. Mock side effects with `vi.fn()` and fixtures in `src/mocks/`. Cover the happy path plus boundary conditions before review. Trigger the suite with `npm run test` and keep it passing before pushing.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat:`, `fix:`, `chore:`) with focused, imperative summaries. Each PR should describe the problem, solution, and validation steps (e.g., `npm run test`). Link issues using `Fixes #id` or `Refs #id`, and attach screenshots or gifs for UI changes. Rebase onto the latest main branch prior to opening the PR.

## Environment & Data Hygiene
Document every environment flag in `.env.example` and read them through `import.meta.env`. Never store secrets or patient data in the repo. Large binaries belong in shared storage—reference download instructions in the README when required.

## Fracture Pipeline Implementation
Replicate the PyBullet fracture flow in-browser. Extend `src/components/HavokViewer.tsx` to capture Havok collision events, extracting world-space `point`, `normal`, and `impulse` before transforming them into the impacted mesh’s local frame. Serialize the top impacts per frame into a job queue. Run neural inference using an ONNX export of the PyTorch model via `onnxruntime-web` (WebGL/WebGPU backend) inside a Web Worker; target a `Float32Array` volume of 128³ values. Replace Fiji/ImageJ steps with WebGL/WebGPU compute passes that implement extended minima, imposed minima, and watershed segmentation; reuse shared utilities in `src/lib/volume/`. Swap the Python mesh booleans for an in-memory JS CSG workflow (e.g., `three-mesh-bvh` with `three-bvh-csg`) that splits fragments without temp files. Feed each fragment back through Babylon by instantiating meshes, materials, and `PhysicsAggregate` bodies seeded with the preserved linear and angular velocity. Keep intermediate buffers in memory, and gate the fracture trigger with configurable thresholds to avoid spurious splits.

The morphology shim currently lives in `src/lib/volume/morphology.ts`; it thresholds the 128³ volume and returns aggregate statistics that ship back through the worker response. Replace this stub with WebGPU kernels for the watershed pipeline when bringing the real segmentation online.
