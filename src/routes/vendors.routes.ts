import express from "express";
import {
  completeVendorDocument,
  createRazorpayOrder,
  createVendorOnboarding,
  findVendorOnboardingByEmail,
  getVendorOnboarding,
  getVendorStatus,
  presignVendorDocument,
  submitVendorOnboarding,
  updateVendorOnboarding,
  verifyRazorpayPayment,
} from "../controllers/vendors.controllers";

const router = express.Router();

router.post("/onboarding", createVendorOnboarding);
router.get("/onboarding", findVendorOnboardingByEmail);
router.get("/:vendorId/onboarding", getVendorOnboarding);
router.patch("/:vendorId/onboarding", updateVendorOnboarding);
router.post("/:vendorId/documents/presign", presignVendorDocument);
router.post("/:vendorId/documents/complete", completeVendorDocument);
router.post("/:vendorId/payments/razorpay/order", createRazorpayOrder);
router.post("/:vendorId/payments/razorpay/verify", verifyRazorpayPayment);
router.post("/:vendorId/submit", submitVendorOnboarding);
router.get("/:vendorId/status", getVendorStatus);

export default router;
