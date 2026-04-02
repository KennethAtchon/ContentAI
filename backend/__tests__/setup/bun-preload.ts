/**
 * Bun test preload for backend unit/integration tests.
 * Load with: bunfig.toml [test] preload = ["./__tests__/setup/bun-preload.ts"]
 */
import { mock } from "bun:test";
import { TextEncoder, TextDecoder } from "util";

// ---------------------------------------------------------------------------
// Polyfills
// ---------------------------------------------------------------------------
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

(global as any).Request = class Request {
  _url: string;
  method: string;
  headers: Headers;
  body: any;
  constructor(url: string | { url: string }, options: any = {}) {
    this._url = typeof url === "string" ? url : (url as { url: string }).url;
    this.method = options.method || "GET";
    this.headers = new Headers(options.headers || {});
    this.body = options.body;
  }
  get url() {
    return this._url;
  }
  clone() {
    return new (global as any).Request(this._url, {
      method: this.method,
      headers: this.headers,
      body: this.body,
    });
  }
  async json() {
    return JSON.parse(this.body || "{}");
  }
  async text() {
    return this.body || "";
  }
  async formData() {
    const formData = new FormData();
    if (this.body) {
      const params = new URLSearchParams(this.body);
      for (const [key, value] of params) {
        formData.append(key, value);
      }
    }
    return formData;
  }
};

(global as any).Response = class Response {
  body: any;
  status: number;
  statusText: string;
  headers: Headers;
  constructor(body: any, options: any = {}) {
    this.body = body;
    this.status = options.status ?? 200;
    this.statusText = options.statusText ?? "OK";
    this.headers = new Headers(options.headers || {});
  }
  get ok() {
    return this.status >= 200 && this.status < 300;
  }
  static json(body: any, options: any = {}) {
    return new (global as any).Response(JSON.stringify(body), {
      ...options,
      headers: { "content-type": "application/json", ...options.headers },
    });
  }
  async json() {
    return JSON.parse(this.body || "{}");
  }
  async text() {
    return this.body || "";
  }
  clone() {
    return new (global as any).Response(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
    });
  }
};

class HeadersMap extends Map {
  get(key: string) {
    return super.get(key.toLowerCase()) ?? null;
  }
  set(key: string, value: string) {
    return super.set(key.toLowerCase(), value);
  }
  has(key: string) {
    return super.has(key.toLowerCase());
  }
  delete(key: string) {
    return super.delete(key.toLowerCase());
  }
}

(global as any).Headers = class Headers extends HeadersMap {
  constructor(init?: any) {
    super();
    if (init) {
      if (init instanceof Headers) {
        for (const [k, v] of (init as any).entries()) this.set(k, v);
      } else if (Array.isArray(init)) {
        for (const [k, v] of init) this.set(k, v);
      } else if (typeof init === "object") {
        for (const [k, v] of Object.entries(init)) this.set(k, String(v));
      }
    }
  }
};

// ---------------------------------------------------------------------------
// Environment variables
// ---------------------------------------------------------------------------
process.env.APP_ENV = "test";
process.env.NEXT_PUBLIC_FIREBASE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "test-api-key";
process.env.FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "test-api-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
  "test-project.firebaseapp.com";
process.env.FIREBASE_AUTH_DOMAIN =
  process.env.FIREBASE_AUTH_DOMAIN || "test-project.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "test-project";
process.env.FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || "test-project";
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "test-project.appspot.com";
process.env.FIREBASE_STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET || "test-project.appspot.com";
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID =
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "000000000000";
process.env.FIREBASE_MESSAGING_SENDER_ID =
  process.env.FIREBASE_MESSAGING_SENDER_ID || "000000000000";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID =
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
  "1:000000000000:web:000000000000000000000000";
process.env.FIREBASE_APP_ID =
  process.env.FIREBASE_APP_ID || "1:000000000000:web:000000000000000000000000";
process.env.FIREBASE_CLIENT_EMAIL =
  process.env.FIREBASE_CLIENT_EMAIL ||
  "test-service-account@test-project.iam.gserviceaccount.com";
process.env.FIREBASE_PRIVATE_KEY =
  process.env.FIREBASE_PRIVATE_KEY ||
  "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7test\n-----END PRIVATE KEY-----\n";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/template_test?schema=public";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
// AES-256-GCM requires exactly 32 bytes; a host env may set a non-conforming key.
{
  const k = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY =
    k && k.length === 32 ? k : "a".repeat(32);
}
process.env.CSRF_SECRET = process.env.CSRF_SECRET || "0".repeat(64);
process.env.CORS_ALLOWED_ORIGINS =
  process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3000";
process.env.RESEND_API_KEY =
  process.env.RESEND_API_KEY || "re_test_placeholder";
process.env.STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder";
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_placeholder";

// ---------------------------------------------------------------------------
// Global mock refs
// ---------------------------------------------------------------------------
const adminAuthMocks = {
  verifyIdToken: mock(),
  getUser: mock(),
  setCustomUserClaims: mock(),
};

// Drizzle db mock — returns a chainable builder that resolves to []
function makeChainableMock(resolveValue: any = []) {
  const chain: any = {};
  const chainMethods = [
    "select",
    "from",
    "where",
    "insert",
    "values",
    "update",
    "set",
    "delete",
    "innerJoin",
    "leftJoin",
    "orderBy",
    "limit",
    "offset",
    "returning",
    "onConflictDoUpdate",
    "execute",
  ];
  chainMethods.forEach((m) => {
    chain[m] = mock(() => chain);
  });
  // Make the chain thenable (awaitable)
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(resolveValue).then(resolve, reject);
  chain[Symbol.toStringTag] = "Promise";
  return chain;
}

const dbMock = {
  select: mock(() => makeChainableMock([])),
  insert: mock(() => makeChainableMock([])),
  update: mock(() => makeChainableMock([])),
  delete: mock(() => makeChainableMock([])),
  execute: mock(() => Promise.resolve([{ health_check: 1 }])),
  query: {},
};

const debugLogMocks = {
  info: mock(),
  warn: mock(),
  error: mock(),
  debug: mock(),
};

const requireAuthMock = mock();
const requireAdminMock = mock();
const requireCSRFTokenMock = mock();
const generateCSRFToken = (sessionId: string) => `csrf-${sessionId}`;
const validateCSRFTokenMock = mock(() => true);
const extractCSRFTokenMock = mock(async (request: any) => {
  const headerToken = request?.headers?.get?.("X-CSRF-Token");
  return typeof headerToken === "string" && headerToken.trim()
    ? headerToken.trim()
    : null;
});
const getCSRFTokenResponse = (firebaseUID: string) => ({
  csrfToken: generateCSRFToken(firebaseUID),
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
});
const applyRateLimitMock = mock();
const determineRateLimitTypeMock = mock();
const getRateLimitHeadersMock = mock();

const timeServiceMocks = {
  getBrowserTimezone: mock(() => "America/New_York"),
  fromUTC: mock((utc: string) => utc),
  formatWithLabel: mock(
    (_d: string, _tz: string, fmt: string) => `Formatted: ${fmt}`,
  ),
};

const piiMocks = {
  sanitizeObject: mock((obj: unknown) => obj),
  sanitizeString: mock((s: string) => s),
};

const systemLoggerMocks = {
  info: mock(),
  warn: mock(),
  error: mock(),
  rateLimit: mock(),
  security: mock(),
  critical: mock(),
  memory: mock(),
  redis: mock(),
  database: mock(),
  auth: mock(),
  csrf: mock(),
  performance: mock(),
  lifecycle: mock(),
};

/** In-memory Redis for tests — supports video job persistence and health checks. */
const redisTestStore = new Map<string, string>();
const redisTestMocks = {
  ping: mock(() => Promise.resolve("PONG")),
  set: mock(
    async (key: string, value: string, _mode?: string, _ttl?: number) => {
      redisTestStore.set(key, value);
      return "OK";
    },
  ),
  get: mock(async (key: string) => redisTestStore.get(key) ?? null),
  del: mock(async (key: string) => (redisTestStore.delete(key) ? 1 : 0)),
};

(global as any).__testMocks__ = {
  adminAuth: adminAuthMocks,
  db: dbMock,
  debugLog: debugLogMocks,
  requireAuth: requireAuthMock,
  requireAdmin: requireAdminMock,
  requireCSRFToken: requireCSRFTokenMock,
  generateCSRFToken,
  applyRateLimit: applyRateLimitMock,
  determineRateLimitType: determineRateLimitTypeMock,
  getRateLimitHeaders: getRateLimitHeadersMock,
  timeService: timeServiceMocks,
  pii: piiMocks,
  systemLogger: systemLoggerMocks,
  redisTestStore,
  redisTestMocks,
};

// Default mocks
applyRateLimitMock.mockResolvedValue(null);
determineRateLimitTypeMock.mockReturnValue("default");
getRateLimitHeadersMock.mockReturnValue({
  "X-RateLimit-Limit": "30",
  "X-RateLimit-Window": "60",
});

// ---------------------------------------------------------------------------
// Module mocks (backend paths: @/ = src/)
// ---------------------------------------------------------------------------
mock.module("firebase-admin", () => ({
  initializeApp: mock(),
  getApps: mock(() => []),
  credential: { cert: mock() },
  auth: mock(() => ({
    verifyIdToken: mock(),
    getUser: mock(),
    setCustomUserClaims: mock(),
  })),
}));

mock.module("firebase-admin/app", () => ({
  initializeApp: mock(),
  getApps: mock(() => []),
  cert: mock(),
}));

mock.module("firebase-admin/auth", () => ({
  getAuth: mock(() => ({
    verifyIdToken: adminAuthMocks.verifyIdToken,
    getUser: adminAuthMocks.getUser,
    setCustomUserClaims: adminAuthMocks.setCustomUserClaims,
  })),
}));

mock.module("@/services/firebase/admin", () => ({
  adminAuth: adminAuthMocks,
}));

mock.module("@/services/db/db", () => ({
  db: dbMock,
  getQueryStats: mock(() => ({
    totalQueries: 0,
    averageTime: 0,
    slowQueries: 0,
    errorQueries: 0,
    topSlowQueries: [],
  })),
  getConnectionPoolStats: mock(() => ({
    totalConnections: 0,
    averageActiveConnections: 0,
    averageIdleConnections: 0,
    peakConnections: 0,
    poolUtilization: 0,
  })),
  ensureConnectionHealth: mock(() => Promise.resolve(true)),
  gracefulShutdown: mock(() => Promise.resolve()),
  timedQuery: mock((_m: any, _o: any, fn: any) => fn()),
}));

mock.module("@/infrastructure/database/drizzle/schema", () => ({
  users: {},
  orders: {},
  contactMessages: {},
  featureUsages: {},
  usersRelations: {},
  ordersRelations: {},
  featureUsagesRelations: {},
  niches: {},
  reels: {},
  reelAnalyses: {},
  generatedContent: {},
  trendingAudio: {},
  instagramPages: {},
  queueItems: {},
  assets: {},
  contentAssets: {},
  projects: {},
  chatSessions: {},
  chatMessages: {},
  messageAttachments: {},
  musicTracks: {},
  editProjects: {},
  exportJobs: {},
  systemConfig: {},
  userSettings: {},
  aiCostLedger: {},
  captionDocs: {},
  captionDocsRelations: {},
  captionPresets: {},
  captions: {},
}));

mock.module("@/utils/debug/debug", () => ({
  debugLog: debugLogMocks,
  default: debugLogMocks,
}));

mock.module("@/features/auth/firebase-middleware", () => ({
  requireAuth: requireAuthMock,
  requireAdmin: requireAdminMock,
}));

mock.module("@/services/csrf/csrf-protection", () => ({
  requireCSRFToken: requireCSRFTokenMock,
  generateCSRFToken,
  validateCSRFToken: validateCSRFTokenMock,
  extractCSRFToken: extractCSRFTokenMock,
  getCSRFTokenResponse,
}));

const rateLimiterMock = () => ({
  applyRateLimit: applyRateLimitMock,
  determineRateLimitType: determineRateLimitTypeMock,
  getRateLimitHeaders: getRateLimitHeadersMock,
  RATE_LIMIT_CONFIGS: {
    default: { window: 60, maxRequests: 30, keyPrefix: "default_rate_limit" },
  },
});
mock.module(
  "@/services/rate-limit/comprehensive-rate-limiter",
  rateLimiterMock,
);

mock.module("@/services/timezone/TimeService", () => ({
  TimeService: {
    getBrowserTimezone: timeServiceMocks.getBrowserTimezone,
    fromUTC: timeServiceMocks.fromUTC,
    formatWithLabel: timeServiceMocks.formatWithLabel,
  },
}));

mock.module("@/utils/security/pii-sanitization", () => ({
  sanitizeObject: piiMocks.sanitizeObject,
  sanitizeString: piiMocks.sanitizeString,
  safeLogError: mock(() => {}),
  LOGGING_CONFIG: {},
  sanitize: piiMocks.sanitizeObject,
}));

mock.module("@/utils/system/system-logger", () => ({
  systemLogger: systemLoggerMocks,
  default: systemLoggerMocks,
  logSystemMemory: (msg: string, op: string, data: any) =>
    systemLoggerMocks.memory(msg, op, data),
  logRedisEvent: (level: string, msg: string, op: string, data?: any) =>
    systemLoggerMocks.redis(level, msg, op, data),
  logSecurityEvent: (level: string, msg: string, op: string, data?: any) =>
    systemLoggerMocks.security(level, msg, op, data),
  logAuthEvent: (level: string, msg: string, op: string, data?: any) =>
    systemLoggerMocks.auth(level, msg, op, data),
  logPerformanceEvent: (msg: string, op: string, data?: any) =>
    systemLoggerMocks.performance(msg, op, data),
}));

mock.module("ioredis", () => ({
  default: class MockRedis {
    on() {
      return this;
    }
    ping = redisTestMocks.ping;
    set = redisTestMocks.set;
    get = redisTestMocks.get;
    del = redisTestMocks.del;
  },
}));

// Console (silence noise in tests)
const noop = mock(() => {});
(global as any).console = {
  ...console,
  error: noop,
  warn: noop,
};
