# Device

Browser/device capability detection plus export-time estimation and benchmark caching.

## Read Order

1. `index.ts`
2. `device-capabilities.ts`
3. `export-estimator.ts`
4. `device-capabilities.test.ts`
5. `export-estimator.test.ts`

## Files

- `device-capabilities.test.ts` - test coverage for the neighboring implementation module.
- `device-capabilities.ts` - detects browser, CPU, memory, GPU, codec, and tier information.
- `export-estimator.test.ts` - test coverage for the neighboring implementation module.
- `export-estimator.ts` - estimates export duration from settings, profile data, and benchmarks.
- `index.ts` - barrel file that defines the public exports for this folder.

## Dependencies

Navigator, WebCodecs/WebGPU availability, local storage, and benchmark measurements.

## Used By

Export settings recommendations, adaptive renderer selection, and performance-aware UI defaults.
