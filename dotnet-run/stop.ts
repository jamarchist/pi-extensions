import { type RunRecord, type StopParams } from "./types.js";
import { stopRecord, stopProcessId } from "./process.js";
import { stopResult } from "./output.js";

export async function stopDotnetRun(runs: Map<string, RunRecord>, params: StopParams) {
  const selected = selectRun(runs, params);
  if (!selected.success) {
    return stopResult({ success: false, stopped: false, errors: selected.errors });
  }

  const { record, processId } = selected;
  if (record?.status === "exited") {
    runs.delete(record.runId);
    return stopResult({
      success: true,
      stopped: false,
      runId: record.runId,
      processId: record.processId,
      errors: [],
      outputTail: record.outputTail || undefined,
      outputTruncated: record.outputTruncated,
    });
  }

  const stopped = record
    ? await stopRecord(record)
    : await stopProcessId(processId, { useProcessGroup: false });

  if (record) runs.delete(record.runId);

  return stopResult({
    success: stopped.success,
    stopped: stopped.success,
    runId: record?.runId ?? params.runId,
    processId: record?.processId ?? processId,
    errors: stopped.errors,
    outputTail: record?.outputTail || undefined,
    outputTruncated: record?.outputTruncated,
  });
}

export async function stopAllDotnetRuns(runs: Map<string, RunRecord>) {
  await Promise.all(
    [...runs.values()].map(async (record) => {
      await stopRecord(record).catch(() => undefined);
    }),
  );
  runs.clear();
}

function selectRun(runs: Map<string, RunRecord>, params: StopParams) {
  if (params.runId) {
    const record = runs.get(params.runId);
    if (!record) {
      return { success: false as const, errors: [`No tracked dotnet run process found for runId: ${params.runId}`] };
    }
    return { success: true as const, record, processId: record.processId };
  }

  if (params.processId !== undefined) {
    const record = [...runs.values()].find((run) => run.processId === params.processId);
    return { success: true as const, record, processId: params.processId };
  }

  const running = [...runs.values()].filter((run) => run.status !== "exited");
  if (running.length === 1) {
    const [record] = running;
    return { success: true as const, record, processId: record.processId };
  }

  if (running.length === 0) {
    return { success: false as const, errors: ["No tracked running dotnet processes. Pass processId to stop an untracked process."] };
  }

  return {
    success: false as const,
    errors: [
      `Multiple tracked dotnet processes are running. Pass one runId: ${running
        .map((run) => run.runId)
        .join(", ")}`,
    ],
  };
}
