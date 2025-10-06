import { describe, expect, it, vi } from "vitest";

import type { FractureJob } from "./types";
import { FractureWorkerClient } from "./workerClient";
import type { FractureWorkerResponse } from "./messages";

class MockWorker {
  public postMessage = vi.fn();
  private listeners = new Set<(event: MessageEvent<FractureWorkerResponse>) => void>();

  addEventListener(
    type: string,
    listener: (event: MessageEvent<FractureWorkerResponse>) => void
  ): void {
    if (type === "message") {
      this.listeners.add(listener);
    }
  }

  removeEventListener(
    type: string,
    listener: (event: MessageEvent<FractureWorkerResponse>) => void
  ): void {
    if (type === "message") {
      this.listeners.delete(listener);
    }
  }

  emit(data: FractureWorkerResponse): void {
    const event = new MessageEvent<FractureWorkerResponse>("message", { data });
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

describe("FractureWorkerClient", () => {
  it("sends process-job messages to the worker", () => {
    const mockWorker = new MockWorker();
    const client = new FractureWorkerClient(() => mockWorker as unknown as Worker);

    const job: FractureJob = {
      meshId: "mesh-001",
      impacts: [],
      sorted: true
    };

    client.submit(job);

    expect(mockWorker.postMessage).toHaveBeenCalledTimes(1);
    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: "process-job",
      job
    });
  });

  it("invokes message listeners when the worker responds", () => {
    const mockWorker = new MockWorker();
    const client = new FractureWorkerClient(() => mockWorker as unknown as Worker);
    const listener = vi.fn();

    const dispose = client.addMessageListener(listener);

    const buffer = new ArrayBuffer(16);
    const response: FractureWorkerResponse = {
      type: "job-completed",
      meshId: "mesh-001",
      impactCount: 2,
      volume: {
        dimensions: [128, 128, 128],
        voxelCount: 128 * 128 * 128,
        impactsUsed: 2,
        buffer,
        summary: {
          voxelMin: -0.5,
          voxelMax: 0.75,
          voxelMean: 0.1,
          impulseMax: 4,
          impulseMean: 2
        }
      },
      morphology: {
        labels: new ArrayBuffer(8),
        summary: {
          regionCount: 1,
          largestRegionSize: 8,
          activeVoxelCount: 8
        }
      }
    };

    mockWorker.emit(response);

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ data: response }));

    dispose();
    mockWorker.emit(response);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
