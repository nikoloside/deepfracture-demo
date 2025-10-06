import { describe, expect, it } from "vitest";

import { runStubMorphology } from "./morphology";

function createVolume(values: number[]): { buffer: ArrayBuffer } {
  const array = new Float32Array(values);
  return { buffer: array.buffer } as any;
}

describe("runStubMorphology", () => {
  it("labels voxels above threshold", () => {
    const volume: any = {
      buffer: new Float32Array([0.05, 0.2, -0.4, 0.12]).buffer
    };

    const result = runStubMorphology(volume);

    expect(Array.from(result.labels)).toEqual([0, 1, 0, 1]);
    expect(result.summary.activeVoxelCount).toBe(2);
    expect(result.summary.regionCount).toBe(1);
    expect(result.summary.largestRegionSize).toBe(2);
  });

  it("handles empty volumes", () => {
    const volume: any = {
      buffer: new Float32Array([0, -0.2, 0.08]).buffer
    };

    const result = runStubMorphology(volume);

    expect(result.summary.activeVoxelCount).toBe(0);
    expect(result.summary.regionCount).toBe(0);
    expect(result.summary.largestRegionSize).toBe(0);
  });
});
