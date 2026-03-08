/**
 * Auth validation schemas and helpers – sign-in, sign-up, field validators.
 */
import { describe, expect, test } from "bun:test";
import {
  signInValidationSchema,
  signUpValidationSchema,
  validateAuthField,
  validateSignInForm,
  validateSignUpForm,
  type SignInFormData,
  type SignUpFormData,
} from "@/utils/validation/auth-validation";

describe("auth-validation", () => {
  describe("signInValidationSchema", () => {
    test("accepts valid email and password", () => {
      const result = signInValidationSchema.safeParse({
        email: "user@example.com",
        password: "securePass123",
      });
      expect(result.success).toBe(true);
    });

    test("rejects invalid email domain", () => {
      const result = signInValidationSchema.safeParse({
        email: "user@a.",
        password: "securePass123",
      });
      expect(result.success).toBe(false);
    });

    test("rejects XSS in email", () => {
      const result = signInValidationSchema.safeParse({
        email: "user<script>@example.com",
        password: "securePass123",
      });
      expect(result.success).toBe(false);
    });

    test("rejects short password", () => {
      const result = signInValidationSchema.safeParse({
        email: "user@example.com",
        password: "short",
      });
      expect(result.success).toBe(false);
    });

    test("rejects SQL injection in password", () => {
      const result = signInValidationSchema.safeParse({
        email: "user@example.com",
        password: "'; DROP TABLE users;--",
      });
      expect(result.success).toBe(false);
    });

    test("rejects XSS in password", () => {
      const result = signInValidationSchema.safeParse({
        email: "user@example.com",
        password: "pass<script>word",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("signUpValidationSchema", () => {
    test("accepts valid sign-up when passwords match", () => {
      const result = signUpValidationSchema.safeParse({
        name: "Jane Doe",
        email: "jane@example.com",
        password: "password123",
        confirmPassword: "password123",
      });
      expect(result.success).toBe(true);
    });

    test("rejects when passwords do not match", () => {
      const result = signUpValidationSchema.safeParse({
        name: "Jane Doe",
        email: "jane@example.com",
        password: "password123",
        confirmPassword: "different",
      });
      expect(result.success).toBe(false);
    });

    test("rejects invalid name (XSS)", () => {
      const result = signUpValidationSchema.safeParse({
        name: "<script>alert(1)</script>",
        email: "jane@example.com",
        password: "password123",
        confirmPassword: "password123",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("validateAuthField", () => {
    test("email: valid", () => {
      const r = validateAuthField.email("user@example.com");
      expect(r.isValid).toBe(true);
      expect(r.error).toBeNull();
    });
    test("email: invalid", () => {
      const r = validateAuthField.email("not-email");
      expect(r.isValid).toBe(false);
      expect(r.error).toBeTruthy();
    });
    test("password: valid", () => {
      const r = validateAuthField.password("validpass123");
      expect(r.isValid).toBe(true);
    });
    test("password: invalid", () => {
      const r = validateAuthField.password("short");
      expect(r.isValid).toBe(false);
    });
    test("name: valid", () => {
      const r = validateAuthField.name("John Doe");
      expect(r.isValid).toBe(true);
    });
    test("name: invalid", () => {
      const r = validateAuthField.name("x");
      expect(r.isValid).toBe(false);
    });
    test("confirmPassword: match", () => {
      const r = validateAuthField.confirmPassword("pass", "pass");
      expect(r.isValid).toBe(true);
    });
    test("confirmPassword: mismatch", () => {
      const r = validateAuthField.confirmPassword("pass", "other");
      expect(r.isValid).toBe(false);
      expect(r.error).toContain("match");
    });
  });

  describe("validateSignInForm", () => {
    test("returns valid and data for good input", () => {
      const result = validateSignInForm({
        email: "u@example.com",
        password: "password123",
      });
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.data).toBeDefined();
        expect((result.data as SignInFormData).email).toBe("u@example.com");
      }
    });

    test("returns errors for invalid input", () => {
      const result = validateSignInForm({
        email: "bad",
        password: "short",
      });
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors).toBeDefined();
        expect(Object.keys(result.errors!).length).toBeGreaterThan(0);
      }
    });
  });

  describe("validateSignUpForm", () => {
    test("returns valid and data for good input", () => {
      const result = validateSignUpForm({
        name: "User Name",
        email: "u@example.com",
        password: "password123",
        confirmPassword: "password123",
      });
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.data).toBeDefined();
        expect((result.data as SignUpFormData).name).toBe("User Name");
      }
    });

    test("returns errors for invalid input", () => {
      const result = validateSignUpForm({
        name: "U",
        email: "bad",
        password: "short",
        confirmPassword: "short",
      });
      expect(result.isValid).toBe(false);
      if (!result.isValid) {
        expect(result.errors).toBeDefined();
      }
    });
  });
});
