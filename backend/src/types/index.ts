/**
 * Backend Type Exports
 *
 * Barrel re-export for all shared backend types.
 */

export type {
  ApiResponse,
  ApiError,
  PaginationMeta,
  PaginatedResponse,
  AsyncState,
} from "./api.types";

export type {
  AuthResult,
  AdminAuthResult,
  AuthContext,
  Variables,
  HonoEnv,
} from "./hono.types";

export type {
  Token,
  TextStyle,
  Transition,
  BaseClip,
  NamedClip,
  VisualClip,
  MediaClipBase,
  VideoClip,
  AudioClip,
  MusicClip,
  TextClip,
  Clip,
  MediaClip,
  CaptionStyleOverrides,
  CaptionClip,
  TrackType,
  Track,
  EditorTracks,
} from "./timeline.types";

export type {
  Subscription,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  SubscriptionUsageStats,
  SubscriptionBillingInfo,
} from "../domain/subscriptions/subscriptions.types";

export type {
  Customer,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerProfile,
} from "../domain/customer/customer.types";

export type {
  Order,
  OrderResponse,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderStatus,
} from "../domain/orders/order.types";

export type {
  CheckoutSession,
  CreateCheckoutRequest,
  PaymentResult,
  StripeWebhookEvent,
  PortalLinkRequest,
  PortalLinkResult,
} from "../domain/payments/payment.types";
