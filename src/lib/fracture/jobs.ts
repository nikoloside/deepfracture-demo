import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { FractureImpact, FractureJob, FractureJobQueue } from "./types";

class InMemoryFractureJobQueue implements FractureJobQueue {
  private jobs: FractureJob[] = [];

  get size(): number {
    return this.jobs.length;
  }

  enqueue(job: FractureJob): void {
    this.jobs.push(job);
  }

  dequeue(): FractureJob | undefined {
    return this.jobs.shift();
  }

  peek(): FractureJob | undefined {
    return this.jobs[0];
  }

  clear(): void {
    this.jobs = [];
  }
}

const fractureQueue = new InMemoryFractureJobQueue();

export function getFractureQueue(): FractureJobQueue {
  return fractureQueue;
}

export function drainFractureQueue(
  queue: FractureJobQueue,
  limit = Number.POSITIVE_INFINITY
): FractureJob[] {
  const drained: FractureJob[] = [];
  let count = 0;
  while (queue.size > 0 && count < limit) {
    const job = queue.dequeue();
    if (!job) {
      break;
    }
    drained.push(job);
    count += 1;
  }
  return drained;
}

export function createFractureJob(meshId: string, impacts: FractureImpact[]): FractureJob {
  const sortedImpacts = impacts
    .map((impact) => ({
      ...impact,
      worldPoint: impact.worldPoint.clone(),
      worldNormal: impact.worldNormal.clone(),
      localPoint: impact.localPoint.clone(),
      localNormal: impact.localNormal.clone()
    }))
    .sort((a, b) => b.impulse - a.impulse);

  return {
    meshId,
    impacts: sortedImpacts,
    sorted: true
  };
}

export function mergeImpactBuffers(impacts: FractureImpact[][]): FractureImpact[] {
  const merged: FractureImpact[] = [];
  for (const batch of impacts) {
    for (const impact of batch) {
      merged.push({
        ...impact,
        worldPoint: impact.worldPoint.clone(),
        worldNormal: impact.worldNormal.clone(),
        localPoint: impact.localPoint.clone(),
        localNormal: impact.localNormal.clone()
      });
    }
  }
  return merged.sort((a, b) => b.impulse - a.impulse);
}

export function isImpactSignificant(impact: FractureImpact, threshold: number): boolean {
  return impact.impulse >= threshold;
}

export function clampImpactBuffer(impacts: FractureImpact[], maxImpacts: number): FractureImpact[] {
  if (impacts.length <= maxImpacts) {
    return impacts;
  }
  return impacts
    .slice()
    .sort((a, b) => b.impulse - a.impulse)
    .slice(0, maxImpacts)
    .map((impact) => ({
      ...impact,
      worldPoint: impact.worldPoint.clone(),
      worldNormal: impact.worldNormal.clone(),
      localPoint: impact.localPoint.clone(),
      localNormal: impact.localNormal.clone()
    }));
}

export function createImpactStub(): FractureImpact {
  return {
    meshId: "",
    timestamp: performance.now(),
    worldPoint: Vector3.Zero(),
    worldNormal: Vector3.Up(),
    impulse: 0,
    localPoint: Vector3.Zero(),
    localNormal: Vector3.Up()
  };
}
