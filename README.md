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

## Fracture Pipeline Implementation Roadmap

1. **Capture Havok impulses** – extend `src/components/HavokViewer.tsx` to read `event.point`, `event.normal`, and `event.impulse` from the Babylon collision observer. Transform them into the impacted mesh’s local coordinates, keep the top impacts per frame, and enqueue fracture jobs with configurable thresholds.
2. **Web inference layer** – export the existing PyTorch fracture model to ONNX and load it with `onnxruntime-web` (WebGL/WebGPU backend) inside a dedicated Web Worker. Feed the serialized impacts and output a `Float32Array` 128×128×128 signed-distance volume.
3. **Morphology in WebGL/WebGPU** – replace the Fiji/ImageJ workflow with custom compute passes (or WASM helpers) that reproduce the extended minima, imposed minima, noise filtering, and watershed steps described in `src/algo/MorphoImageJ.py`. House reusable kernels in `src/lib/volume/`.
4. **Mesh boolean rewrite** – port the `pyMeshBool` splitting logic to TypeScript using an in-memory CSG pipeline (e.g., `three-mesh-bvh` + `three-bvh-csg`). Consume the segmented iso-surface, generate fragment meshes without touching the filesystem, and filter by face count.
5. **Rehydrate rigid bodies** – convert each fragment into a Babylon mesh plus `PhysicsAggregate`, inherit materials, and seed linear/angular velocities from the original body. Disable the source rigid body once fragments spawn and hand them back to Havok for simulation.

### Fracture Worker Harness (in progress)

- Run `npm run test -- --run src/lib/fracture/workerClient.test.ts` to confirm the fracture job client sends `process-job` requests and receives worker callbacks.
- Run `npm run test -- --run src/lib/fracture/workerUtils.test.ts` to verify the synthetic inference metadata mirrors the expected volume statistics.
- Run `npm run test -- --run src/lib/fracture/jobs.test.ts` to ensure the shared fracture queue drains in FIFO order and respects batch limits.
- Run `npm run test -- --run src/lib/volume/morphology.test.ts` to validate the WebGPU/WebGL-friendly morphology stub that thresholds voxels into a single-region mask.
- Start the sandbox with `npm run dev`, launch a projectile into the primary mesh, and watch the browser console for `[FractureWorker]` logs. The viewer overlay also reports the most recent worker event via the `Fracture job completed...` debug line, including the voxel range and impulse mean calculated from the stubbed volume. Impulses below `25` are logged as ignored to keep noise out of the fracture queue.
