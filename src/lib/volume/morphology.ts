import type { FractureWorkerVolumeResult } from "../fracture";

export interface SegmentationSummary {
  regionCount: number;
  largestRegionSize: number;
  activeVoxelCount: number;
}

export interface MorphologyResult {
  summary: SegmentationSummary;
  labels: Uint8Array;
}

const THRESHOLD = 0.1;

export function runStubMorphology(volume: FractureWorkerVolumeResult): MorphologyResult {
  const voxelData = new Float32Array(volume.buffer);
  const labels = new Uint8Array(voxelData.length);
  let activeVoxelCount = 0;

  for (let i = 0; i < voxelData.length; i += 1) {
    if (voxelData[i] >= THRESHOLD) {
      labels[i] = 1;
      activeVoxelCount += 1;
    }
  }

  const summary: SegmentationSummary = {
    regionCount: activeVoxelCount > 0 ? 1 : 0,
    largestRegionSize: activeVoxelCount,
    activeVoxelCount
  };

  return {
    summary,
    labels
  };
}
