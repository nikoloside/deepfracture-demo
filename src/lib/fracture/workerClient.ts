import type { FractureJob } from "./types";
import type { FractureWorkerRequest, FractureWorkerResponse } from "./messages";

type WorkerLike = Pick<Worker, "postMessage" | "addEventListener" | "removeEventListener">;

type WorkerFactory = () => WorkerLike;

type MessageListener = (event: MessageEvent<FractureWorkerResponse>) => void;

const defaultFactory: WorkerFactory = () =>
  new Worker(new URL("../../workers/fractureWorker.ts", import.meta.url), { type: "module" });

export class FractureWorkerClient {
  private readonly worker: WorkerLike;

  constructor(createWorker: WorkerFactory = defaultFactory) {
    this.worker = createWorker();
  }

  submit(job: FractureJob): void {
    const message: FractureWorkerRequest = {
      type: "process-job",
      job
    };
    this.worker.postMessage(message);
  }

  addMessageListener(listener: MessageListener): () => void {
    this.worker.addEventListener("message", listener as EventListener);
    return () => {
      this.worker.removeEventListener("message", listener as EventListener);
    };
  }
}
