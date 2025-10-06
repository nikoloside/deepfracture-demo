import type { FractureJob } from "./types";

export interface FractureWorkerRequest {
  type: "process-job";
  job: FractureJob;
}

export interface FractureWorkerVolumeSummary {
  voxelMin: number;
  voxelMax: number;
  voxelMean: number;
  impulseMax: number;
  impulseMean: number;
}

export interface FractureWorkerVolumeResult {
  dimensions: [number, number, number];
  voxelCount: number;
  impactsUsed: number;
  buffer: ArrayBuffer;
  summary: FractureWorkerVolumeSummary;
}

export interface FractureWorkerMorphologySummary {
  regionCount: number;
  largestRegionSize: number;
  activeVoxelCount: number;
}

export interface FractureWorkerSegmentationResult {
  summary: FractureWorkerMorphologySummary;
  labels: ArrayBuffer;
}

export type FractureWorkerResponse =
  | {
      type: "job-completed";
      meshId: string;
      impactCount: number;
      volume: FractureWorkerVolumeResult;
      morphology: FractureWorkerSegmentationResult;
    }
  | {
      type: "job-error";
      meshId: string;
      error: string;
    };
