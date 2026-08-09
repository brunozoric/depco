import { parentPort, workerData } from "node:worker_threads";

if (parentPort) {
    parentPort.postMessage({ projectId: workerData.projectId });
}
