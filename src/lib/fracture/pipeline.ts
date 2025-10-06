import type { FractureJob } from "./types";

/**
 * Placeholder for the full GPU-accelerated fracture pipeline.
 * Each stage will be replaced with WebGPU/WebGL implementations that mirror
 * the legacy Python flow (model inference → morphology → CSG splitting).
 */
export class FracturePipeline {
  constructor(private readonly options: { impulseThreshold: number }) {}

  async process(job: FractureJob): Promise<void> {
    console.info("FracturePipeline.process pending implementation", {
      job,
      options: this.options
    });
    // TODO(#1): hook up ONNX Runtime web inference and feed the serialized
    // impacts as latent conditioning to reproduce the PyTorch `predict` step.
    // TODO(#2): port the Fiji/ImageJ watershed sequence (extended minima,
    // imposed minima, noise filtering) using WebGPU/WebGL compute kernels.
    // TODO(#3): rewrite the `pyMeshBool` splitting logic with an in-memory
    // boolean pipeline (e.g., three-mesh-bvh + three-bvh-csg) and emit
    // Babylon meshes without touching the filesystem.
  }
}
