import { getApp } from "firebase/app";
import { getStripePayments } from "@invertase/firestore-stripe-payments";

const STRIPE_COLLECTIONS = {
  PRODUCTS: "products",
  CUSTOMERS: "customers",
} as const;

const app = getApp();

export const payments = getStripePayments(app, {
  productsCollection: STRIPE_COLLECTIONS.PRODUCTS,
  customersCollection: STRIPE_COLLECTIONS.CUSTOMERS,
});
