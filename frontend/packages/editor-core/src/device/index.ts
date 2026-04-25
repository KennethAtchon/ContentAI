/**
 * @fileoverview barrel file that defines the public exports for this folder.
 *
 * Folder role: Browser/device capability detection plus export-time estimation and benchmark caching.
 * Read this file with ../types and the folder README nearby; most exports here are wired through the local index.ts barrel.
 */

export {
  type DeviceTier,
  type CpuInfo,
  type MemoryInfo,
  type GpuInfo,
  type DeviceCodecSupport,
  type EncodingSupport,
  type BenchmarkResult,
  type DeviceProfile,
  type CodecRecommendation,
  detectDeviceCapabilities,
  getDeviceProfile,
  getCodecRecommendations,
  getResolutionRecommendations,
  saveBenchmarkResult,
  clearBenchmarkCache,
  formatDeviceSummary,
} from "./device-capabilities";

export {
  type ExportEstimateSettings,
  type TimeEstimate,
  type BenchmarkProgress,
  estimateExportTime,
  compareCodecEstimates,
  runBenchmark,
  shouldRecommendBenchmark,
} from "./export-estimator";
