import { processQueueBatch } from "../lib/queue/processor";

const POLL_INTERVAL_MS = 5000;
let isRunning = true;

async function startWorker() {
  console.log("[Worker] Starting background queue processor...");

  const poll = async () => {
    if (!isRunning) return;

    try {
      const summary = await processQueueBatch({ batchSize: 10 });
      if (summary.processed > 0) {
        console.log(
          `[Worker] Batch processed: ${summary.processed} total (${summary.succeeded} sent, ${summary.failed} failed, ${summary.skipped} skipped, ${summary.capBlocked} cap blocked)`
        );
      }
    } catch (error) {
      console.error("[Worker] Error processing queue:", error);
    }

    if (isRunning) {
      setTimeout(poll, POLL_INTERVAL_MS);
    }
  };

  poll();
}

function stopWorker() {
  console.log("\n[Worker] Gracefully shutting down...");
  isRunning = false;
  setTimeout(() => process.exit(0), 1000);
}

process.on("SIGINT", stopWorker);
process.on("SIGTERM", stopWorker);

startWorker();

