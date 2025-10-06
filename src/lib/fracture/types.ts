import type { Vector3 } from "@babylonjs/core/Maths/math.vector";

export interface FractureImpact {
  meshId: string;
  timestamp: number;
  worldPoint: Vector3;
  worldNormal: Vector3;
  impulse: number;
  localPoint: Vector3;
  localNormal: Vector3;
}

export interface FractureJob {
  meshId: string;
  impacts: FractureImpact[];
  /**
   * Ordered descending by impulse; queue consumers can pull the strongest hits first.
   */
  sorted: boolean;
}

export interface FractureJobQueue {
  readonly size: number;
  enqueue(job: FractureJob): void;
  dequeue(): FractureJob | undefined;
  peek(): FractureJob | undefined;
  clear(): void;
}
