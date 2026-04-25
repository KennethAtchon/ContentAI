import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import Stripe from "stripe";
import { customerService } from "../../domain/singletons";
import { Errors } from "../../utils/errors/app-error";
import { STRIPE_SECRET_KEY } from "../../utils/config/envUtil";
import { createOrderFromStripeCheckoutSession } from "../../domain/customer/customer-stripe-order";
import {
  createCustomerOrderSchema,
  createOrderFromCheckoutSchema,
  customerOrderIdParamSchema,
  customerOrdersQuerySchema,
  orderBySessionQuerySchema,
} from "../../domain/customer/customer.schemas";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";

const stripeClient = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
  : null;

const ordersRouter = new Hono<HonoEnv>();

ordersRouter.get(
  "/orders",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", customerOrdersQuerySchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { page, limit } = c.req.valid("query");

    const result = await customerService.listOrders(auth.user.id, {
      page,
      limit,
    });

    return c.json(result);
  },
);

ordersRouter.post(
  "/orders/create",
  rateLimiter("payment"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator(
    "json",
    createOrderFromCheckoutSchema,
    zodValidationErrorHook,
  ),
  async (c) => {
    if (!stripeClient) {
      throw Errors.internal("Stripe is not configured");
    }

    const auth = c.get("auth");
    const { stripeSessionId, status } = c.req.valid("json");

    const { order, status: httpStatus } =
      await createOrderFromStripeCheckoutSession(
        stripeClient,
        customerService,
        {
          userId: auth.user.id,
          firebaseUid: auth.firebaseUser.uid,
          stripeSessionId,
          status,
        },
      );

    return c.json({ order }, httpStatus);
  },
);

ordersRouter.post(
  "/orders",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", createCustomerOrderSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const body = c.req.valid("json");

    const order = await customerService.createOrder(auth.user.id, {
      totalAmount: String(body.totalAmount),
      status: body.status,
      stripeSessionId: body.stripeSessionId,
    });

    return c.json(order, 201);
  },
);

ordersRouter.get(
  "/orders/by-session",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", orderBySessionQuerySchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { sessionId } = c.req.valid("query");

    const order = await customerService.getOrderByStripeSessionId(
      auth.user.id,
      sessionId,
    );

    if (!order) {
      throw Errors.notFound("Order");
    }

    return c.json(order);
  },
);

ordersRouter.get(
  "/orders/total-revenue",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");

    const totalRevenue = await customerService.getTotalRevenue(auth.user.id);

    return c.json({ totalRevenue });
  },
);

ordersRouter.get(
  "/orders/:orderId",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", customerOrderIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { orderId } = c.req.valid("param");

    const order = await customerService.getOrderById(auth.user.id, orderId);

    return c.json(order);
  },
);

ordersRouter.post(
  "/fix-stripe-customer",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    return c.json({ message: "Stripe customer ID cleared successfully" });
  },
);

export default ordersRouter;
