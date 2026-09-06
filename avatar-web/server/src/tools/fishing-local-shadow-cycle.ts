import { createHash } from 'node:crypto';
import { constants, promises as fs } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CanCauPayload } from '../game/fishingDecode.js';
import { InferenceClient, MAX_CANONICAL_REQUEST_BYTES } from '../fishing/inferenceClient.js';
import {
  buildLocalShadowAggregateReport,
  LOCAL_SHADOW_CASES,
  LOCAL_SHADOW_CYCLE_ID,
  LocalShadowCycleController,
  type LocalShadowCase,
  type LocalShadowCaseResult,
} from '../fishing/localShadowCycle.js';
import type { ShadowConfig } from '../fishing/shadowConfig.js';

interface ToolArgs {
  readonly replayGatePath: string;
  readonly replayGateSha256: string;
  readonly quarantinePath: string;
  readonly quarantineSha256: string;
  readonly fixtureManifestPath: string;
  readonly fixtureSha256: string;
  readonly outputPath: string;
  readonly port: number;
}

interface ImageEntry {
  readonly index: number;
  readonly path: string;
  readonly sha256: string;
}

interface FixtureManifest {
  readonly batchId: string;
  readonly idFish: number;
  readonly timeDelayMs: number;
  readonly images: readonly ImageEntry[];
  readonly imagesNew: readonly ImageEntry[];
}

type FixtureMode = Exclude<LocalShadowCase, 'post_kill_switch_disabled_before_http'>;

interface FixtureState {
  mode: FixtureMode;
  requestCount: number;
  fatalError?: Error;
}

const HEX64 = /^[0-9a-f]{64}$/;
const SAFE_ID = /^[A-Za-z0-9._-]+$/;
const FIXTURE_MODEL_ID = 'local-shadow-fixture-v1';
const WRONG_MODEL_ID = 'local-shadow-fixture-v2';
const CLIENT_TIMEOUT_MS = 250;
const MAX_JSON_BYTES = 1_048_576;
const MAX_PNG_BYTES = 960_000;
const MANIFEST_KEYS = new Set([
  'schemaVersion',
  'batchId',
  'capturedAt',
  'map',
  'area',
  'idFish',
  'timeDelayMs',
  'images',
  'imagesNew',
]);
const IMAGE_KEYS = new Set(['index', 'path', 'sha256']);
const REPLAY_GATE_KEYS = new Set([
  'schemaVersion',
  'gate',
  'status',
  'policySha256',
  'evidenceSha256',
  'checks',
  'failures',
  'blockers',
  'cycle',
]);
const QUARANTINE_KEYS = new Set([
  'schemaVersion',
  'cycleId',
  'parentDatasetId',
  'parentDatasetVersionSha256',
  'parentFinalSplitSha256',
  'parentFinalBatchIds',
  'diagnosticCycleId',
  'diagnosticInventorySha256',
  'diagnosticBatchCount',
  'diagnosticBatchCommitment',
  'diagnosticBatchIds',
  'reasons',
]);
const ARGUMENT_KEYS = new Set([
  '--replay-gate',
  '--replay-gate-sha256',
  '--quarantine',
  '--quarantine-sha256',
  '--fixture-manifest',
  '--fixture-sha256',
  '--output',
  '--port',
]);

function isExactObject(value: unknown, keys: ReadonlySet<string>): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const present = Object.keys(value);
  return present.length === keys.size && present.every((key) => keys.has(key));
}

function parseArgs(argv: readonly string[]): ToolArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === undefined || !ARGUMENT_KEYS.has(key)) {
      throw new Error('unsupported local-shadow argument');
    }
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`missing value for ${key}`);
    }
    if (values.has(key)) throw new Error(`duplicate argument ${key}`);
    values.set(key, value);
  }
  if (values.size !== ARGUMENT_KEYS.size) {
    throw new Error('local-shadow command arguments are incomplete');
  }
  const replayGateSha256 = values.get('--replay-gate-sha256')!;
  const quarantineSha256 = values.get('--quarantine-sha256')!;
  const fixtureSha256 = values.get('--fixture-sha256')!;
  if (!HEX64.test(replayGateSha256) || !HEX64.test(quarantineSha256) || !HEX64.test(fixtureSha256)) {
    throw new Error('local-shadow command digests must be lowercase SHA-256');
  }
  const portText = values.get('--port')!;
  if (!/^\d+$/.test(portText)) throw new Error('local-shadow port must be an integer');
  const port = Number(portText);
  if (!Number.isSafeInteger(port) || port < 1_024 || port > 65_535) {
    throw new Error('local-shadow port must be from 1024 through 65535');
  }
  return {
    replayGatePath: values.get('--replay-gate')!,
    replayGateSha256,
    quarantinePath: values.get('--quarantine')!,
    quarantineSha256,
    fixtureManifestPath: values.get('--fixture-manifest')!,
    fixtureSha256,
    outputPath: values.get('--output')!,
    port,
  };
}

function sha256(body: Uint8Array): string {
  return createHash('sha256').update(body).digest('hex');
}

async function readRegularFile(filePath: string, field: string, maximumBytes: number): Promise<Buffer> {
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await fs.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size > maximumBytes) {
      throw new Error(`${field} must be one bounded regular file`);
    }
    return await handle.readFile();
  } finally {
    await handle?.close();
  }
}

function parseJson(body: Buffer, field: string): unknown {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    throw new Error(`${field} must be UTF-8 JSON`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${field} must be valid JSON`);
  }
}

function validateReplayGate(document: unknown): void {
  if (!isExactObject(document, REPLAY_GATE_KEYS)) {
    throw new Error('replay gate fields mismatch');
  }
  const cycle = document.cycle;
  if (!isExactObject(cycle, new Set(['cycleId', 'experimentId', 'datasetId']))) {
    throw new Error('replay gate cycle fields mismatch');
  }
  if (
    document.schemaVersion !== 2
    || document.gate !== 'replay'
    || document.status !== 'pass'
    || cycle.cycleId !== LOCAL_SHADOW_CYCLE_ID
    || cycle.experimentId !== LOCAL_SHADOW_CYCLE_ID
    || cycle.datasetId !== 'phase2-coverage-recovery-v2-20260906-01'
    || !HEX64.test(String(document.policySha256))
    || !HEX64.test(String(document.evidenceSha256))
    || !Array.isArray(document.checks)
    || !Array.isArray(document.failures)
    || document.failures.length !== 0
    || !Array.isArray(document.blockers)
    || document.blockers.length !== 0
  ) {
    throw new Error('local shadow requires an exact cycle replay PASS gate');
  }
}

function safeId(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 255 || !SAFE_ID.test(value)) {
    throw new Error(`${field} must be one safe identifier`);
  }
  return value;
}

function validateQuarantine(document: unknown): Set<string> {
  if (!isExactObject(document, QUARANTINE_KEYS)) {
    throw new Error('quarantine fields mismatch');
  }
  if (
    document.schemaVersion !== 2
    || document.cycleId !== LOCAL_SHADOW_CYCLE_ID
    || document.parentDatasetId !== 'phase2-20260904-01'
    || !HEX64.test(String(document.parentDatasetVersionSha256))
    || !HEX64.test(String(document.parentFinalSplitSha256))
    || document.diagnosticCycleId !== 'p2cr-20260905-01'
    || !HEX64.test(String(document.diagnosticInventorySha256))
    || document.diagnosticBatchCount !== 90
    || !HEX64.test(String(document.diagnosticBatchCommitment))
    || !Array.isArray(document.parentFinalBatchIds)
    || document.parentFinalBatchIds.length !== 30
    || !Array.isArray(document.diagnosticBatchIds)
    || document.diagnosticBatchIds.length !== 90
    || !Array.isArray(document.reasons)
    || document.reasons.length !== 2
    || document.reasons[0] !== 'post-policy-diagnostic'
    || document.reasons[1] !== 'previous-final-exposed'
  ) {
    throw new Error('quarantine does not match the cycle contract');
  }
  const parentFinalBatchIds = document.parentFinalBatchIds.map(
    (value, index) => safeId(value, `parentFinalBatchIds[${index}]`),
  );
  const diagnosticBatchIds = document.diagnosticBatchIds.map(
    (value, index) => safeId(value, `diagnosticBatchIds[${index}]`),
  );
  if (
    new Set(parentFinalBatchIds).size !== parentFinalBatchIds.length
    || [...parentFinalBatchIds].sort().some(
      (value, index) => value !== parentFinalBatchIds[index],
    )
    || new Set(diagnosticBatchIds).size !== diagnosticBatchIds.length
    || [...diagnosticBatchIds].sort().some(
      (value, index) => value !== diagnosticBatchIds[index],
    )
  ) {
    throw new Error('quarantine batch IDs must be sorted and unique');
  }
  if (parentFinalBatchIds.some((batchId) => diagnosticBatchIds.includes(batchId))) {
    throw new Error('quarantine batch ID sets must not overlap');
  }
  const diagnosticCommitment = sha256(
    Buffer.from(`${diagnosticBatchIds.join('\n')}\n`, 'utf8'),
  );
  if (diagnosticCommitment !== document.diagnosticBatchCommitment) {
    throw new Error('diagnostic quarantine commitment mismatch');
  }
  return new Set([...parentFinalBatchIds, ...diagnosticBatchIds]);
}

function parseImageEntries(value: unknown, directory: 'img' | 'new'): readonly ImageEntry[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) {
    throw new Error(`${directory} fixture entries must contain 1 through 64 images`);
  }
  return value.map((entry, index) => {
    if (!isExactObject(entry, IMAGE_KEYS)) throw new Error(`${directory}[${index}] fields mismatch`);
    const expectedPath = `${directory}/${index}.png`;
    if (entry.index !== index || entry.path !== expectedPath || !HEX64.test(String(entry.sha256))) {
      throw new Error(`${directory}[${index}] identity mismatch`);
    }
    return { index, path: expectedPath, sha256: String(entry.sha256) };
  });
}

function validateFixtureManifest(document: unknown): FixtureManifest {
  if (!isExactObject(document, MANIFEST_KEYS)) throw new Error('fixture manifest fields mismatch');
  if (
    document.schemaVersion !== 1
    || typeof document.capturedAt !== 'string'
    || document.capturedAt.length === 0
    || (!Number.isSafeInteger(document.map) && document.map !== null)
    || (!Number.isSafeInteger(document.area) && document.area !== null)
    || !Number.isSafeInteger(document.idFish)
    || Number(document.idFish) < 0
    || !Number.isSafeInteger(document.timeDelayMs)
    || Number(document.timeDelayMs) < 0
  ) {
    throw new Error('fixture manifest scalar fields are invalid');
  }
  return {
    batchId: safeId(document.batchId, 'fixture batchId'),
    idFish: Number(document.idFish),
    timeDelayMs: Number(document.timeDelayMs),
    images: parseImageEntries(document.images, 'img'),
    imagesNew: parseImageEntries(document.imagesNew, 'new'),
  };
}

function isContained(root: string, candidate: string): boolean {
  return candidate.startsWith(`${root}${path.sep}`);
}

function validatePng(buffer: Buffer, field: string): void {
  if (
    buffer.length < 33
    || buffer.readUInt32BE(0) !== 0x89504e47
    || buffer.readUInt32BE(4) !== 0x0d0a1a0a
    || buffer.readUInt32BE(8) !== 13
    || buffer.toString('ascii', 12, 16) !== 'IHDR'
    || buffer.readUInt32BE(16) !== 75
    || buffer.readUInt32BE(20) !== 75
    || ![2, 6].includes(buffer[25]!)
  ) {
    throw new Error(`${field} must be a 75x75 RGB/RGBA PNG`);
  }
}

async function loadFixtureImages(
  manifestPath: string,
  entries: readonly ImageEntry[],
  field: string,
): Promise<Buffer[]> {
  const root = await fs.realpath(path.dirname(path.resolve(manifestPath)));
  const images: Buffer[] = [];
  for (const entry of entries) {
    const candidate = path.join(root, entry.path);
    const realPath = await fs.realpath(candidate);
    if (!isContained(root, realPath)) throw new Error(`${field}[${entry.index}] escapes fixture root`);
    const body = await readRegularFile(realPath, `${field}[${entry.index}]`, MAX_PNG_BYTES);
    if (sha256(body) !== entry.sha256) throw new Error(`${field}[${entry.index}] digest mismatch`);
    validatePng(body, `${field}[${entry.index}]`);
    images.push(body);
  }
  return images;
}

async function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_CANONICAL_REQUEST_BYTES) throw new Error('fixture request exceeded client contract');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, total);
}

function predictionResponse(body: Buffer, modelId: string): string {
  const document = parseJson(body, 'fixture request');
  if (!isExactObject(document, new Set(['schemaVersion', 'references', 'queries']))) {
    throw new Error('fixture request fields mismatch');
  }
  if (
    document.schemaVersion !== 1
    || !Array.isArray(document.references)
    || document.references.length < 1
    || !Array.isArray(document.queries)
    || document.queries.length < 1
  ) {
    throw new Error('fixture request shape mismatch');
  }
  return JSON.stringify({
    schemaVersion: 1,
    modelId,
    predictions: document.queries.map((_query, queryIndex) => ({
      queryIndex,
      referenceIndex: 0,
      similarity: 0.99,
      margin: 0.50,
      accepted: true,
    })),
    latencyMs: 1,
  });
}

function finishResponse(response: ServerResponse, body: string): void {
  const payload = Buffer.from(body, 'utf8');
  response.writeHead(200, {
    'connection': 'close',
    'content-length': String(payload.length),
    'content-type': 'application/json',
  });
  response.end(payload);
}

async function handleFixtureRequest(
  request: IncomingMessage,
  response: ServerResponse,
  state: FixtureState,
): Promise<void> {
  state.requestCount += 1;
  if (request.method !== 'POST' || request.url !== '/infer') {
    throw new Error('fixture server received an unexpected route');
  }
  if (state.mode === 'unavailable') {
    request.socket.destroy();
    return;
  }
  const body = await readRequestBody(request);
  if (state.mode === 'timeout') {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, CLIENT_TIMEOUT_MS * 4);
      timer.unref?.();
    });
    if (!response.destroyed) finishResponse(response, predictionResponse(body, FIXTURE_MODEL_ID));
    return;
  }
  if (state.mode === 'malformed_response') {
    finishResponse(response, '{not-json');
    return;
  }
  finishResponse(
    response,
    predictionResponse(body, state.mode === 'wrong_model_identity' ? WRONG_MODEL_ID : FIXTURE_MODEL_ID),
  );
}

function createFixtureServer(state: FixtureState): Server {
  return createServer((request, response) => {
    void handleFixtureRequest(request, response, state).catch((error: unknown) => {
      state.fatalError = error instanceof Error ? error : new Error('fixture server failure');
      response.destroy();
    });
  });
}

async function listenLoopback(server: Server, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => reject(error);
    server.once('error', onError);
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.removeListener('error', onError);
      resolve();
    });
  });
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections?.();
  });
}

async function requireOutputAbsent(outputPath: string): Promise<string> {
  const absolutePath = path.resolve(outputPath);
  const directory = path.dirname(absolutePath);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const directoryMetadata = await fs.lstat(directory);
  if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink()) {
    throw new Error('local-shadow output parent must be a real directory');
  }
  try {
    await fs.lstat(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return absolutePath;
    throw error;
  }
  const conflict = new Error('local-shadow output already exists') as NodeJS.ErrnoException;
  conflict.code = 'EEXIST';
  throw conflict;
}

async function publishNoReplace(outputPath: string, document: unknown): Promise<void> {
  const absolutePath = path.resolve(outputPath);
  const directory = path.dirname(absolutePath);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const directoryMetadata = await fs.lstat(directory);
  if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink()) {
    throw new Error('local-shadow output parent must be a real directory');
  }
  const handle = await fs.open(absolutePath, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(document)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  const parent = await fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    await parent.sync();
  } finally {
    await parent.close();
  }
}

function sanitizedErrorCode(error: unknown): string {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === 'EEXIST') return 'output_exists';
  if (code === 'EADDRINUSE') return 'port_unavailable';
  if (code === 'ECONNREFUSED') return 'connection_failed';
  if (error instanceof Error && /argument|digest|fields|contract|fixture|gate|quarantine|path|file|JSON|UTF-8|PNG|identifier/.test(error.message)) {
    return 'invalid_input';
  }
  return 'operation_failed';
}

export async function runLocalShadowCycle(args: ToolArgs): Promise<{
  readonly exitCode: 0 | 3;
  readonly terminalState: 'READY_FOR_SEPARATE_LIVE_SHADOW_REVIEW' | 'LOCAL_SHADOW_FAIL';
  readonly output: string;
  readonly outputSha256: string;
}> {
  const replayGateBody = await readRegularFile(args.replayGatePath, 'replay gate', MAX_JSON_BYTES);
  if (sha256(replayGateBody) !== args.replayGateSha256) throw new Error('replay gate digest mismatch');
  validateReplayGate(parseJson(replayGateBody, 'replay gate'));

  const quarantineBody = await readRegularFile(args.quarantinePath, 'quarantine', MAX_JSON_BYTES);
  if (sha256(quarantineBody) !== args.quarantineSha256) throw new Error('quarantine digest mismatch');
  const quarantinedBatchIds = validateQuarantine(parseJson(quarantineBody, 'quarantine'));

  const fixtureBody = await readRegularFile(
    args.fixtureManifestPath,
    'fixture manifest',
    MAX_JSON_BYTES,
  );
  if (sha256(fixtureBody) !== args.fixtureSha256) throw new Error('fixture digest mismatch');
  const fixture = validateFixtureManifest(parseJson(fixtureBody, 'fixture manifest'));
  if (quarantinedBatchIds.has(fixture.batchId)) {
    throw new Error('fixture batch is quarantined');
  }
  const outputPath = await requireOutputAbsent(args.outputPath);
  const [images, imagesNew] = await Promise.all([
    loadFixtureImages(args.fixtureManifestPath, fixture.images, 'images'),
    loadFixtureImages(args.fixtureManifestPath, fixture.imagesNew, 'imagesNew'),
  ]);
  const payload: CanCauPayload = {
    idUser: 0,
    idFish: fixture.idFish,
    timeDelayMs: fixture.timeDelayMs,
    images,
    imagesNew,
  };

  const state: FixtureState = { mode: 'success', requestCount: 0 };
  const server = createFixtureServer(state);
  const endpoint = `http://127.0.0.1:${args.port}/infer`;
  const config: ShadowConfig = {
    enabled: true,
    killSwitch: false,
    endpoint,
    timeoutMs: CLIENT_TIMEOUT_MS,
    sampleRate: 1,
    circuitBreaker: { failureThreshold: 10, resetMs: 60_000, maxInFlight: 1 },
  };
  const controller = new LocalShadowCycleController(new InferenceClient(config));
  const results: LocalShadowCaseResult[] = [];
  let continuationCount = 0;

  await listenLoopback(server, args.port);
  try {
    for (const name of LOCAL_SHADOW_CASES) {
      if (name === 'post_kill_switch_disabled_before_http') controller.kill();
      else state.mode = name;
      results.push(await controller.runCase(name, payload, () => {
        continuationCount += 1;
      }));
      if (state.fatalError !== undefined) throw state.fatalError;
    }
  } finally {
    await closeServer(server);
  }

  const report = buildLocalShadowAggregateReport({
    replayGateSha256: args.replayGateSha256,
    fixtureSha256: args.fixtureSha256,
    continuationCount,
    httpRequestCount: state.requestCount,
    gameplaySideEffectCount: 0,
    cases: results,
  });
  await publishNoReplace(outputPath, report);
  const outputBody = await readRegularFile(outputPath, 'local-shadow report', MAX_JSON_BYTES);
  const passed = report.status === 'PASS';
  return {
    exitCode: passed ? 0 : 3,
    terminalState: passed
      ? 'READY_FOR_SEPARATE_LIVE_SHADOW_REVIEW'
      : 'LOCAL_SHADOW_FAIL',
    output: outputPath,
    outputSha256: sha256(outputBody),
  };
}

async function main(): Promise<void> {
  try {
    const result = await runLocalShadowCycle(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result));
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(JSON.stringify({
      status: 'BLOCKED',
      terminalState: 'LOCAL_SHADOW_BLOCKED',
      errorCode: sanitizedErrorCode(error),
    }));
    process.exitCode = 4;
  }
}

const entryPath = process.argv[1] === undefined ? undefined : path.resolve(process.argv[1]);
if (entryPath === fileURLToPath(import.meta.url)) void main();
