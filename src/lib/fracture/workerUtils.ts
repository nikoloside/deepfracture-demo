import type { FractureJob } from "./types";
import type {
  FractureWorkerSegmentationResult,
  FractureWorkerVolumeResult
} from "./messages";
import { runStubMorphology } from "../volume";

const DEFAULT_DIMENSIONS: [number, number, number] = [128, 128, 128];

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function product(dimensions: [number, number, number]): number {
  return dimensions[0] * dimensions[1] * dimensions[2];
}

export function generateStubVolume(
  job: FractureJob,
  dimensions: [number, number, number] = DEFAULT_DIMENSIONS
): FractureWorkerVolumeResult {
  const voxelCount = product(dimensions);
  const buffer = new Float32Array(voxelCount);
  const impulses = job.impacts.map((impact) => impact.impulse);
  const impulseMax = impulses.length > 0 ? Math.max(...impulses) : 0;
  const impulseMean =
    impulses.length > 0 ? impulses.reduce((sum, value) => sum + value, 0) / impulses.length : 0;
  const impactsUsed = job.impacts.length;

  const seed = Math.max(
    1,
    Math.floor(
      impulses.reduce((acc, value, index) => acc + value * (index + 1), 0) + dimensions[0] * 13
    )
  );

  const rng = createRng(seed);

  let voxelMin = Number.POSITIVE_INFINITY;
  let voxelMax = Number.NEGATIVE_INFINITY;
  let voxelSum = 0;

  const scale = impulseMax > 0 ? Math.min(impulseMax / (impulseMean || impulseMax), 2) : 1;

  for (let i = 0; i < voxelCount; i += 1) {
    const raw = rng() * 2 - 1; // [-1, 1]
    const value = raw * scale;
    buffer[i] = value;
    voxelMin = Math.min(voxelMin, value);
    voxelMax = Math.max(voxelMax, value);
    voxelSum += value;
  }

  const volumeMean = voxelCount > 0 ? voxelSum / voxelCount : 0;

  return {
    dimensions,
    voxelCount,
    impactsUsed,
    buffer: buffer.buffer,
    summary: {
      voxelMin,
      voxelMax,
      voxelMean: volumeMean,
      impulseMax,
      impulseMean
    }
  };
}

export function buildStubFractureOutputs(
  job: FractureJob
): {
  volume: FractureWorkerVolumeResult;
  morphology: FractureWorkerSegmentationResult;
} {
  const volume = generateStubVolume(job);
  const morphologyResult = runStubMorphology(volume);
  return {
    volume,
    morphology: {
      summary: morphologyResult.summary,
      labels: morphologyResult.labels.buffer
    }
  };
}
