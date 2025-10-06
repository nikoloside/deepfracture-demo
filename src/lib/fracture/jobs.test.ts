import { describe, expect, it } from "vitest";

import { createFractureJob, getFractureQueue, drainFractureQueue } from "./jobs";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { FractureImpact } from "./types";

function makeImpact(impulse: number): FractureImpact {
  return {
    meshId: "mesh",
    timestamp: Date.now(),
    worldPoint: new Vector3(0, 0, 0),
    worldNormal: new Vector3(0, 0, 1),
    impulse,
    localPoint: new Vector3(0, 0, 0),
    localNormal: new Vector3(0, 0, 1)
  };
}

describe("drainFractureQueue", () => {
  it("returns enqueued jobs in FIFO order", () => {
    const queue = getFractureQueue();
    queue.clear();

    queue.enqueue(createFractureJob("mesh-1", [makeImpact(10)]));
    queue.enqueue(createFractureJob("mesh-2", [makeImpact(20)]));

    const jobs = drainFractureQueue(queue);

    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.meshId).toBe("mesh-1");
    expect(jobs[1]?.meshId).toBe("mesh-2");
  });

  it("respects the limit parameter", () => {
    const queue = getFractureQueue();
    queue.clear();

    queue.enqueue(createFractureJob("mesh-1", [makeImpact(10)]));
    queue.enqueue(createFractureJob("mesh-2", [makeImpact(20)]));

    const jobs = drainFractureQueue(queue, 1);

    expect(jobs).toHaveLength(1);
    expect(queue.size).toBe(1);
  });
});
