# DeepFracture Demo

A Vite + React + TypeScript playground for prototyping the DeepFracture research dashboard. The UI currently mocks inference responses so designers and researchers can iterate on presentation while model services are under development.

## Getting Started

1. Install dependencies (Node 18+ recommended):
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Run unit tests via Vitest:
   ```bash
   npm run test
   ```
4. Build a production bundle:
   ```bash
   npm run build
   ```
5. Preview the optimized build locally:
   ```bash
   npm run preview
   ```

## Project Layout

```
DeepFracture-demo/
├── src/
│   ├── App.tsx            # Feature panels and mocked inference results
│   ├── main.tsx           # React entrypoint
│   ├── index.css          # Global resets
│   ├── App.css            # Component styles
│   ├── assets/
│   │   └── react.svg      # Sample asset
│   └── vite-env.d.ts      # Vite module declarations
├── public/                # Static assets served as-is (create as needed)
├── vite.config.ts         # Vite configuration
├── vitest.config.ts       # Vitest configuration
├── vitest.setup.ts        # Test environment bootstrap
├── tsconfig*.json         # TypeScript configs
├── eslint.config.js       # Flat ESLint config
├── package.json           # Scripts and dependencies
└── README.md
```

## Contributing Notes

- Run `npm run lint` before submitting changes to ensure ESLint passes.
- Place mock data and shared view models in `src/mocks/` or `src/lib/` (create these folders as needed) to keep components lean.
- Document environment variables in `.env.example` and avoid committing secrets.
- Havok physics depends on the bundled runtime at `public/havok/HavokPhysics.wasm`; refresh this file if the `@babylonjs/havok` package is upgraded.
