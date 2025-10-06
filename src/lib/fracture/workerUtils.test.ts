import { describe, expect, it } from "vitest";

import type { FractureJob } from "./types";
import { buildStubFractureOutputs, generateStubVolume } from "./workerUtils";

function createJob(impulses: number[]): FractureJob {
  return {
    meshId: "mesh-001",
    sorted: true,
    impacts: impulses.map((impulse, index) => ({
      meshId: "mesh-001",
      timestamp: index,
      worldPoint: { x: 0, y: 0, z: 0 } as any,
      worldNormal: { x: 0, y: 0, z: 1 } as any,
      impulse,
      localPoint: { x: 0, y: 0, z: 0 } as any,
      localNormal: { x: 0, y: 0, z: 1 } as any
    }))
  };
}

describe("generateStubVolume", () => {
  it("returns zeroed metadata when there are no impacts", () => {
    const result = generateStubVolume(createJob([]), [8, 8, 8]);
    const volume = new Float32Array(result.buffer);

    expect(result.dimensions).toEqual([8, 8, 8]);
    expect(result.voxelCount).toBe(8 * 8 * 8);
    expect(result.impactsUsed).toBe(0);
    expect(result.summary.impulseMax).toBe(0);
    expect(result.summary.impulseMean).toBe(0);
    expect(result.summary.voxelMin).toBeLessThanOrEqual(result.summary.voxelMax);
    expect(result.summary.voxelMean).toBeCloseTo(volume.reduce((sum, v) => sum + v, 0) / volume.length);
  });

  it("summarizes impulse statistics for impacts", () => {
    const result = generateStubVolume(createJob([10, 20, 30]), [8, 8, 8]);
    const volume = new Float32Array(result.buffer);

    expect(result.summary.impulseMax).toBe(30);
    expect(result.summary.impulseMean).toBeCloseTo(20);
    expect(result.impactsUsed).toBe(3);
    expect(result.summary.voxelMin).toBeLessThanOrEqual(result.summary.voxelMax);
    expect(result.summary.voxelMin).toBeGreaterThanOrEqual(-5);
    expect(result.summary.voxelMax).toBeLessThanOrEqual(5);
    expect(volume.length).toBe(8 * 8 * 8);
  });
});

describe("buildStubFractureOutputs", () => {
  it("returns morphology summary aligned with volume", () => {
    const job = createJob([0.05, 0.5, 0.2]);
    const outputs = buildStubFractureOutputs(job);

    expect(outputs.morphology.summary.activeVoxelCount).toBeGreaterThan(0);
    expect(outputs.morphology.summary.regionCount).toBe(1);
    expect(outputs.morphology.labels.byteLength).toBe(outputs.volume.voxelCount);
  });
});
