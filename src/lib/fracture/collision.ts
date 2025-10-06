import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { IPhysicsCollisionEvent } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import type { FractureImpact } from "./types";

export interface ImpactExtractionOptions {
  threshold?: number;
  maxImpacts?: number;
}

export function toFractureImpact(
  mesh: TransformNode,
  event: IPhysicsCollisionEvent,
  options: ImpactExtractionOptions = {}
): FractureImpact | null {
  const { point, normal, impulse } = event;
  if (!point || !normal) {
    return null;
  }

  const threshold = options.threshold ?? 0;
  if (impulse < threshold) {
    return null;
  }

  const worldMatrix = mesh.getWorldMatrix();
  const inverseWorld = Matrix.Invert(worldMatrix);

  const worldPoint = point.clone();
  const worldNormal = normal.clone();

  const localPoint = Vector3.TransformCoordinates(worldPoint, inverseWorld);
  const localNormal = Vector3.TransformNormal(worldNormal, inverseWorld).normalize();

  return {
    meshId: mesh.uniqueId.toString(),
    timestamp: performance.now(),
    worldPoint,
    worldNormal,
    impulse,
    localPoint,
    localNormal
  };
}

export function bufferImpact(
  buffer: FractureImpact[],
  impact: FractureImpact | null,
  options: ImpactExtractionOptions = {}
): FractureImpact[] {
  if (!impact) {
    return buffer;
  }

  const maxImpacts = options.maxImpacts ?? Infinity;

  const next = [...buffer, impact];
  if (next.length <= maxImpacts) {
    return next;
  }

  return next
    .sort((a, b) => b.impulse - a.impulse)
    .slice(0, maxImpacts);
}
