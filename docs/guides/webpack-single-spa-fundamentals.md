# Webpack Fundamentals for `single-spa`

This guide explains how Webpack works at a deep level and how each core concept maps to a `single-spa` microfrontend architecture.

## Who this is for

Use this if you are:
- New to Webpack internals
- Splitting a frontend into microfrontends with `single-spa`
- Troubleshooting bundle loading, shared dependencies, or runtime errors across multiple apps

## Mental model first

Webpack is a **build-time module graph compiler**:
- It starts from one or more **entry points**
- Follows every `import`/`require` to build a dependency graph
- Transforms files with **loaders**
- Changes compilation behavior with **plugins**
- Emits one or more browser-consumable **bundles/chunks**

`single-spa` is a **runtime orchestrator**:
- It decides *when* each application should load/mount/unmount
- It does not compile your code
- It relies on your bundles being emitted in a format it can load (usually SystemJS modules)

In short:
- Webpack answers: "How is each microfrontend built?"
- `single-spa` answers: "When and where does each microfrontend run?"

## Core Webpack fundamentals

## 1) Entry points and the module graph

`entry` is where Webpack starts graph traversal.

Example (simplified):

```js
module.exports = {
  entry: './src/index.ts',
}
```

What happens:
- Webpack parses `./src/index.ts`
- Finds all imports
- Recursively resolves those imports
- Builds an in-memory graph of modules and dependencies

In `single-spa` apps, the entry usually exports lifecycle functions (`bootstrap`, `mount`, `unmount`) rather than calling `ReactDOM.render` once like a traditional SPA.

## 2) Output: bundles, chunks, and runtime

Webpack emits files based on `output`.

Common settings:
- `filename`: main bundle naming
- `chunkFilename`: async chunk naming
- `path`: disk destination
- `publicPath`: URL prefix for runtime chunk loading

In microfrontends, `publicPath` is especially important. If wrong, lazy-loaded chunks resolve from the wrong origin/path and fail with chunk load errors.

## 3) Loaders (file transforms)

Loaders transform non-browser-native sources into JS modules Webpack can bundle.

Typical transforms:
- `ts-loader` or `babel-loader`: TypeScript/JS transpilation
- `css-loader` + `style-loader` or extraction plugin: CSS handling
- Asset modules: images/fonts

Rule of thumb:
- Loaders answer: "How do I convert this file type into something bundleable?"

## 4) Plugins (compiler extensions)

Plugins hook into Webpack compiler lifecycle.

Common examples:
- `HtmlWebpackPlugin` for HTML generation (less central in `single-spa` child apps)
- `DefinePlugin` for constants/env replacement
- `MiniCssExtractPlugin` for CSS extraction
- `ModuleFederationPlugin` when using module federation

Rule of thumb:
- Plugins answer: "How do I change compilation/output behavior globally?"

## 5) Modes and optimization

Modes:
- `development`: faster builds, easier debugging
- `production`: minification, tree-shaking, long-term cache optimizations

Optimization features include:
- Dead code elimination (tree-shaking)
- Scope hoisting
- Split chunks
- Deterministic ids for stable caching

In `single-spa`, each microfrontend is its own optimization boundary. A suboptimal config in one app can hurt only that app, but shared dependency strategy affects all apps.

## 6) Code splitting and lazy loading

Webpack creates extra chunks via:
- Dynamic imports (`import('./feature')`)
- `optimization.splitChunks`

At runtime, Webpack loader fetches missing chunks from `publicPath`.

In `single-spa`:
- `single-spa` may lazy-load the microfrontend shell
- Inside that app, Webpack may *also* lazy-load feature chunks
- Both layers must resolve URLs correctly

## 7) Source maps and debugging

`devtool` controls source map strategy.

Typical choices:
- Development: `eval-source-map` or `cheap-module-source-map`
- Production: `source-map` (often uploaded to observability tooling)

For microfrontends, source map management should include app/version metadata so stack traces map to the correct deployed artifact.

## 8) Caching and content hashes

Production bundles should usually include `[contenthash]`.

Why:
- Browser/CDN cache can keep old assets
- Hash changes only when file content changes
- Enables long cache TTL with safe cache busting

In `single-spa`, this matters per microfrontend deployment. One app can roll out independently without invalidating every other app's cache.

## How `single-spa` changes the build target

## Runtime contract in `single-spa`

Each microfrontend exports lifecycle functions:
- `bootstrap`
- `mount`
- `unmount`

Webpack still bundles code, but output must be consumable by the loader used in your root config (commonly SystemJS + import maps).

## SystemJS + import maps + Webpack

A common setup:
- Root config uses import maps to map app names to URLs
- Browser/SystemJS loads those URLs
- Each URL points to a Webpack-produced bundle in System module format

Key implication:
- Your bundle format is not arbitrary; it must match what loader expects.

Historically this often means:
- `output.libraryTarget = 'system'` (Webpack 4)
- `output.library.type = 'system'` (Webpack 5 style)

Many teams use helper packages (`single-spa-webpack-config`, `systemjs-webpack-interop`) to standardize this.

## Public path in distributed deployments

In monolith SPAs, `publicPath: '/'` is often okay.

In `single-spa`, each app may be hosted at a different domain/path/CDN key.

So each microfrontend must set runtime public path correctly, often dynamically from script URL. Otherwise async chunk fetches can point to root-config domain instead of the child app domain.

## Externalizing shared dependencies

Without sharing, each microfrontend may bundle its own React, ReactDOM, utility libs, etc.

Options:
- Bundle everything per app (simple, larger payload)
- Externalize selected deps (smaller per-app bundles, stronger version coordination requirements)

With externals + import maps:
- React can be loaded once and mapped globally
- Microfrontends import it as external

Tradeoff:
- Better network efficiency
- Tighter coupling on compatible shared versions

## Versioning strategy across microfrontends

Independent deployments are the main advantage of `single-spa`, but shared runtime dependencies create compatibility risk.

Practical patterns:
- Keep framework majors aligned across microfrontends
- Treat shared externals as a platform contract
- Roll out shared dependency upgrades with staged validation

## CSS and style isolation considerations

Webpack can bundle CSS per microfrontend, but runtime collisions can still occur:
- Global selectors overlap
- Reset styles conflict
- Design token drift across teams

Mitigations:
- CSS Modules or scoped naming conventions
- Shadow DOM (where appropriate)
- Platform-level design tokens and linting rules

## Dev workflow with Webpack + `single-spa`

Typical local setup:
- Each microfrontend has its own Webpack dev server
- Root config runs separately
- Import maps point app names to local dev URLs

Benefits:
- Parallel team development
- Reload one app without rebuilding all

Common pain points:
- CORS misconfiguration
- Inconsistent HTTPS/local cert setup
- Stale import map overrides
- Chunk URLs resolving to wrong origin

## Deployment model

Common production flow:
1. Build each microfrontend with Webpack
2. Upload versioned assets to CDN/object storage
3. Publish/update import map entry to new URL
4. Root config loads new app version without full platform redeploy

This is where Webpack asset hashing, deterministic output, and stable chunk loading behavior directly affect release safety.

## Minimal config shape (Webpack 5 style)

This is intentionally minimal to show key points only:

```js
module.exports = {
  mode: 'production',
  entry: './src/root.ts',
  output: {
    filename: '[name].[contenthash].js',
    chunkFilename: '[name].[contenthash].js',
    publicPath: 'auto',
    library: {
      type: 'system',
    },
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\\.[jt]sx?$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
    ],
  },
  externals: {
    react: 'react',
    'react-dom': 'react-dom',
  },
}
```

Notes:
- `publicPath: 'auto'` helps runtime chunk URL resolution
- `library.type: 'system'` aligns output with SystemJS consumption
- `externals` assumes import maps or another runtime provider for those modules

## Troubleshooting map (symptom -> likely cause)

- "Application never mounts": lifecycle exports missing or wrong entry wiring
- "404 on async chunk": incorrect `publicPath` or CDN path layout
- "React hooks invalid call": duplicate React copies across microfrontends
- "Works standalone but fails in root": standalone HTML hides import-map/runtime differences
- "Intermittent production only failures": stale import map, cache invalidation, or non-hashed asset references

## Decision checklist for a healthy setup

- Is bundle output format compatible with your runtime loader (SystemJS or alternative)?
- Is `publicPath` correct for every environment (local, staging, prod)?
- Are shared dependencies intentionally externalized (or intentionally not)?
- Are content hashes enabled for JS/CSS assets?
- Are source maps generated and attached to release versions?
- Is import map rollout atomic and reversible?

## Summary

Webpack and `single-spa` solve different layers of the frontend platform:
- Webpack builds each microfrontend artifact
- `single-spa` composes those artifacts at runtime

Most production issues happen at the boundary between the two:
- Wrong module format
- Wrong public path
- Wrong shared dependency strategy

If these three are correct, teams usually unlock the main benefits of microfrontends: independent deploys, safer releases, and faster parallel development.
