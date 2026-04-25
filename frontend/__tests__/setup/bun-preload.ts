/**
 * Bun test preload: polyfills, env, and module mocks.
 * Load with: bunfig.toml [test] preload = ["./__tests__/setup/bun-preload-fixed.ts"]
 */
import { mock } from "bun:test";
import { TextEncoder, TextDecoder } from "util";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// ---------------------------------------------------------------------------
// DOM (for React Testing Library and component tests)
// ---------------------------------------------------------------------------
GlobalRegistrator.register();

// Add cleanup hook to unregister Happy-DOM after all tests
process.on("exit", () => {
  GlobalRegistrator.unregister();
});

// Also add cleanup for SIGINT and SIGTERM for better coverage
process.on("SIGINT", () => {
  GlobalRegistrator.unregister();
  process.exit(0);
});

process.on("SIGTERM", () => {
  GlobalRegistrator.unregister();
  process.exit(0);
});

// Add more aggressive cleanup - unregister after each test file
// This helps prevent memory accumulation in test suites
if (typeof afterEach !== "undefined") {
  afterEach(() => {
    // Force cleanup of DOM references
    if (typeof document !== "undefined") {
      document.body.innerHTML = "";
    }
    // Clear any remaining timers
    if (typeof clearTimeout !== "undefined") {
      const maxTimerId = setTimeout(() => {}, 0);
      for (let i = 1; i <= maxTimerId; i++) {
        clearTimeout(i);
      }
    }
  });
}

// Set a global timeout to prevent infinite hanging
// Using a simple timeout mechanism for Bun
const originalTest = global.test || global.it;
if (originalTest) {
  const testWithTimeout = function (name, fn, timeout = 5000) {
    return originalTest(name, function () {
      const timeoutId = setTimeout(() => {
        console.error(`Test timeout: ${name}`);
        process.exit(1);
      }, timeout);

      try {
        const result = fn.apply(this, arguments);
        clearTimeout(timeoutId);
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    });
  };

  global.test = testWithTimeout;
  global.it = testWithTimeout;
}

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
// Env
// ---------------------------------------------------------------------------
process.env.APP_ENV = "test";
process.env.NEXT_PUBLIC_FIREBASE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "test-api-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
  "test-project.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "test-project";
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "test-project.appspot.com";
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID =
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "000000000000";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID =
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
  "1:000000000000:web:000000000000000000000000";
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
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "a".repeat(32);
// 32-byte key as 64 hex chars for AES-256-GCM (real csrf-protection tests)
process.env.CSRF_SECRET = process.env.CSRF_SECRET || "0".repeat(64);
process.env.CORS_ALLOWED_ORIGINS =
  process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3000";
// Needed for resend email validation tests to exercise the validation path
process.env.RESEND_API_KEY =
  process.env.RESEND_API_KEY || "re_test_placeholder";

// ---------------------------------------------------------------------------
// Global mock refs for tests to override (e.g. mockResolvedValue)
// ---------------------------------------------------------------------------
const adminAuthMocks = {
  verifyIdToken: mock(),
  getUser: mock(),
  setCustomUserClaims: mock(),
};

const prismaUserMocks = {
  findUnique: mock(),
  findMany: mock(),
  count: mock(),
  update: mock(),
  create: mock(),
};

const prismaFeatureUsageMocks = {
  count: mock(),
  create: mock(),
  findMany: mock(),
  findFirst: mock(),
};

const prismaOrderMocks = {
  findUnique: mock(),
  findFirst: mock(),
  findMany: mock(),
  count: mock(),
  create: mock(),
  update: mock(),
  aggregate: mock(),
};

const prismaContactMessageMocks = {
  findMany: mock(),
  count: mock(),
  create: mock(),
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
    (_d: string, _tz: string, fmt: string) => `Formatted: ${fmt}`
  ),
};

const envUtilMocks = {
  getAllowedCorsOrigins: mock(() => ["http://localhost:3000"]),
  shouldUseSecureCookies: mock(() => false),
  ENCRYPTION_KEY: "a".repeat(32),
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

(global as any).__testMocks__ = {
  adminAuth: adminAuthMocks,
  prisma: {
    user: prismaUserMocks,
    order: prismaOrderMocks,
    contactMessage: prismaContactMessageMocks,
  },
  debugLog: debugLogMocks,
  requireAuth: requireAuthMock,
  requireAdmin: requireAdminMock,
  requireCSRFToken: requireCSRFTokenMock,
  generateCSRFToken,
  applyRateLimit: applyRateLimitMock,
  determineRateLimitType: determineRateLimitTypeMock,
  getRateLimitHeaders: getRateLimitHeadersMock,
  timeService: timeServiceMocks,
  envUtil: envUtilMocks,
  pii: piiMocks,
  systemLogger: systemLoggerMocks,
};

// Default: rate limit passes
applyRateLimitMock.mockResolvedValue(null);
determineRateLimitTypeMock.mockReturnValue("default");
getRateLimitHeadersMock.mockReturnValue({
  "X-RateLimit-Limit": "30",
  "X-RateLimit-Window": "60",
});

// ---------------------------------------------------------------------------
// Module mocks (paths match app imports; use preload so they apply before imports)
// ---------------------------------------------------------------------------
mock.module("next/navigation", () => ({
  useRouter: () => ({
    push: mock(),
    replace: mock(),
    prefetch: mock(),
    back: mock(),
    forward: mock(),
    refresh: mock(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

mock.module("next/image", () => ({
  __esModule: true,
  default: (_props: any) => null,
}));

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

// Mock Firebase client to prevent duplicate app errors
const mockFirebaseApp = { name: "[DEFAULT]", options: {} };

mock.module("firebase/app", () => ({
  initializeApp: mock(() => mockFirebaseApp),
  getApps: mock(() => [mockFirebaseApp]),
  getApp: mock(() => mockFirebaseApp),
  deleteApp: mock(),
}));

mock.module("firebase/auth", () => ({
  getAuth: mock(() => ({})),
  onAuthStateChanged: mock(),
  signInWithEmailAndPassword: mock(),
  createUserWithEmailAndPassword: mock(),
  signOut: mock(),
  updateProfile: mock(),
  signInWithPopup: mock(),
  GoogleAuthProvider: class {},
}));

mock.module("firebase/firestore", () => ({
  getFirestore: mock(() => ({})),
  collection: mock(() => ({})),
  doc: mock(() => ({})),
  getDoc: mock(),
  getDocs: mock(),
  setDoc: mock(),
  addDoc: mock(),
  updateDoc: mock(),
  deleteDoc: mock(),
  onSnapshot: mock(),
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

mock.module("@/shared/platform/firebase-services/admin", () => ({
  adminAuth: adminAuthMocks,
}));

const prismaMock = {
  user: prismaUserMocks,
  featureUsage: prismaFeatureUsageMocks,
  order: prismaOrderMocks,
  contactMessage: prismaContactMessageMocks,
  $queryRaw: mock().mockResolvedValue([{ health_check: 1 }]),
};
// Default featureUsage for reels/usage/calculate routes
prismaFeatureUsageMocks.count.mockResolvedValue(0);
prismaFeatureUsageMocks.create.mockResolvedValue({});
prismaFeatureUsageMocks.findMany.mockResolvedValue([]);
prismaFeatureUsageMocks.findFirst.mockResolvedValue(null);
// Default order mocks
prismaOrderMocks.findMany.mockResolvedValue([]);
prismaOrderMocks.findUnique.mockResolvedValue(null);
prismaOrderMocks.findFirst.mockResolvedValue(null);
prismaOrderMocks.count.mockResolvedValue(0);
prismaOrderMocks.create.mockResolvedValue({});
prismaOrderMocks.update.mockResolvedValue({});
prismaOrderMocks.aggregate.mockResolvedValue({ _sum: { totalAmount: null } });
// Default contactMessage mocks
prismaContactMessageMocks.findMany.mockResolvedValue([]);
prismaContactMessageMocks.count.mockResolvedValue(0);
prismaContactMessageMocks.create.mockResolvedValue({
  id: "msg-new",
  name: "Test User",
  email: "test@example.com",
  subject: "Test Subject",
  createdAt: new Date(),
});
// Mock PrismaClient constructor for routes that create their own instance
// (e.g. contact-messages route imports PrismaClient from infrastructure path)
mock.module("@/infrastructure/database/lib/generated/prisma", () => ({
  PrismaClient: class MockPrismaClient {
    contactMessage = prismaContactMessageMocks;
    user = prismaUserMocks;
    featureUsage = prismaFeatureUsageMocks;
    order = prismaOrderMocks;
    $queryRaw = mock().mockResolvedValue([{ health_check: 1 }]);
    $connect = mock(() => Promise.resolve());
    $disconnect = mock(() => Promise.resolve());
  },
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {},
    PrismaClientInitializationError: class extends Error {},
    dmmf: {
      datamodel: {
        models: [
          {
            name: "User",
            fields: [
              {
                name: "id",
                type: "String",
                isRequired: true,
                isId: true,
                hasDefaultValue: true,
                isList: false,
              },
              {
                name: "email",
                type: "String",
                isRequired: true,
                isId: false,
                hasDefaultValue: false,
                isList: false,
              },
            ],
          },
          {
            name: "Order",
            fields: [
              {
                name: "id",
                type: "String",
                isRequired: true,
                isId: true,
                hasDefaultValue: true,
                isList: false,
              },
            ],
          },
        ],
      },
    },
  },
}));

mock.module("@/shared/services/db/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
  getQueryStats: mock(() => ({
    totalQueries: 0,
    averageTime: 0,
    slowQueries: 0,
    errorQueries: 0,
    topSlowQueries: [],
  })),
  getConnectionPoolStats: mock(() => ({})),
}));

const storageServiceMock = {
  uploadFile: mock(() =>
    Promise.resolve("https://storage.example.com/file.jpg")
  ),
  deleteFile: mock(() => Promise.resolve()),
  getPublicUrl: mock((path: string) => `https://storage.example.com/${path}`),
};
const storageMockFactory = () => ({
  storage: storageServiceMock,
  getStorage: mock(() => storageServiceMock),
});
mock.module("@/shared/services/storage", storageMockFactory);
mock.module("@/shared/services/storage/index", storageMockFactory);

mock.module("@/shared/debug", () => ({
  debugLog: debugLogMocks,
  default: debugLogMocks,
}));

mock.module("@/shared/debug/debug", () => ({
  debugLog: debugLogMocks,
  default: debugLogMocks,
}));

// Do not mock envUtil — use real module with process.env set above (ENCRYPTION_KEY, etc.)

mock.module("@/domains/auth/api/firebase-middleware", () => ({
  requireAuth: requireAuthMock,
  requireAdmin: requireAdminMock,
}));

mock.module("@/shared/services/csrf/csrf-protection", () => ({
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
  "@/shared/services/rate-limit/comprehensive-rate-limiter",
  rateLimiterMock
);
// Bun may resolve @/ to ./ from project root
mock.module(
  "./shared/services/rate-limit/comprehensive-rate-limiter",
  rateLimiterMock
);

const checkRateLimitMock = mock();
mock.module("@/shared/services/rate-limit/rate-limit-redis", () => ({
  checkRateLimit: checkRateLimitMock,
}));
checkRateLimitMock.mockResolvedValue(true);

// App uses TimeService.getBrowserTimezone() etc. — export as TimeService object
mock.module("@/shared/time/timezone/TimeService", () => ({
  TimeService: {
    getBrowserTimezone: timeServiceMocks.getBrowserTimezone,
    fromUTC: timeServiceMocks.fromUTC,
    formatWithLabel: timeServiceMocks.formatWithLabel,
  },
}));

mock.module("@/shared/security/pii-sanitization", () => ({
  sanitizeObject: piiMocks.sanitizeObject,
  sanitizeString: piiMocks.sanitizeString,
  safeLogError: mock(() => {}),
  LOGGING_CONFIG: {},
  sanitize: piiMocks.sanitizeObject,
}));

mock.module("@/shared/system/system-logger", () => ({
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
  logPerformanceEvent: (msg: string, op: string, data: any) =>
    systemLoggerMocks.performance(msg, op, data),
}));

// global-error-handler and api-error-wrapper are NOT mocked in preload so that
// unit tests in __tests__/unit/error-handling/ can test the real implementations.
// Integration tests that need mocked versions (api-health-ready, api-analytics)
// register their own mock.module calls in those files.
// The real implementations safely use mocked loggers (debugLog, systemLogger).

// Console - completely suppress error/warn logs during tests to prevent CI noise
// React error boundary tests intentionally throw errors that should be caught
const noop = mock(() => {});

(global as any).console = {
  ...console,
  error: noop,
  warn: noop,
};
