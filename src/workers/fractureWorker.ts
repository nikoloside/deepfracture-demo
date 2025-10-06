import type { FractureWorkerRequest, FractureWorkerResponse } from "../lib/fracture/messages";
import { buildStubFractureOutputs } from "../lib/fracture/workerUtils";

export {};

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", (event: MessageEvent<FractureWorkerRequest>) => {
  const message = event.data;
  if (!message) {
    return;
  }

  if (message.type === "process-job") {
    const { job } = message;
    try {
      const { volume, morphology } = buildStubFractureOutputs(job);
      const impactCount = volume.impactsUsed;

      console.info("[FractureWorker] Synthetic inference complete", {
        meshId: job.meshId,
        impactCount,
        summary: volume.summary,
        morphology: morphology.summary
      });

      const response: FractureWorkerResponse = {
        type: "job-completed",
        meshId: job.meshId,
        impactCount,
        volume,
        morphology
      };
      ctx.postMessage(response, [volume.buffer, morphology.labels]);
    } catch (error) {
      const response: FractureWorkerResponse = {
        type: "job-error",
        meshId: message.job.meshId,
        error: error instanceof Error ? error.message : "Unknown fracture worker error"
      };
      ctx.postMessage(response);
    }
  }
});
