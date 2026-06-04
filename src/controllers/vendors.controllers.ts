import crypto from "crypto";
import { Request, Response } from "express";
import Razorpay from "razorpay";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "../configs/db";

const validOrgTypes = new Set(["Hospital", "Diagnostic Center", "Specialty Clinic"]);
const validPlans = new Set(["Standard", "Pro", "Premium"]);
const validDocumentTypes = new Set(["business_license", "moh_accreditation", "tax_identification"]);
const planAmountsInPaise: Record<string, number> = {
  Standard: 100,
  Pro: 200,
  Premium: 300,
};

const immutableOnboardingStatuses = new Set([
  "UNDER_REVIEW",
  "PENDING_ACTIVATION",
  "ACTIVE",
  "REJECTED",
]);

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const s3Bucket = process.env.BUCKET_NAME;
const razorpayKeyId = process.env.RAZOR_PAY_KEY_ID;
const razorpayKeySecret = process.env.RAZOR_PAY_KEY_SECRET;

const isValidEmail = (value: unknown) =>
  typeof value === "string" && /^\S+@\S+\.\S+$/.test(value);

const isValidContactNumber = (value: unknown) =>
  typeof value === "string" && /^[0-9]{10}$/.test(value);

const getVendorId = (params: Record<string, unknown>) => {
  const vendorId = params.vendorId;
  if (!vendorId) {
    return null;
  }
  return Array.isArray(vendorId) ? vendorId[0] : vendorId;
};

const ensureRazorpayClient = () => {
  if (!razorpayKeyId || !razorpayKeySecret) {
    throw new Error("Razorpay keys are required in environment variables");
  }

  return new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
};

const getStatusAfterDocumentUpdate = (documents: Record<string, any>, paymentStatus?: string) => {
  const hasAllDocuments = [...validDocumentTypes].every((type) => Boolean(documents[type]));
  if (!hasAllDocuments) {
    return "DOCUMENTS_PENDING" as const;
  }

  if (paymentStatus === "COMPLETED") {
    return "UNDER_REVIEW" as const;
  }

  return "PAYMENT_PENDING" as const;
};

export const createVendorOnboarding = async (req: Request, res: Response) => {
  try {
    const { orgName, address, email, contactPerson, contactNumber, orgType, specialties, plan } = req.body;

    if (!orgName || typeof orgName !== "string") {
      return res.status(400).json({ message: "orgName is required" });
    }
    if (!address || typeof address !== "string") {
      return res.status(400).json({ message: "address is required" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Valid email is required" });
    }
    if (!contactPerson || typeof contactPerson !== "string") {
      return res.status(400).json({ message: "contactPerson is required" });
    }
    if (!isValidContactNumber(contactNumber)) {
      return res.status(400).json({ message: "Valid 10-digit contactNumber is required" });
    }
    if (!validOrgTypes.has(orgType)) {
      return res.status(400).json({ message: "orgType must be Hospital, Diagnostic Center or Specialty Clinic" });
    }
    if (!Array.isArray(specialties) || specialties.length === 0) {
      return res.status(400).json({ message: "At least one specialty is recommended" });
    }
    if (!validPlans.has(plan)) {
      return res.status(400).json({ message: "plan must be Standard, Pro or Premium" });
    }

    const existingOnboarding = await prisma.vendorOnboarding.findUnique({ where: { email } });
    if (existingOnboarding) {
      return res.status(409).json({
        message: "Existing onboarding draft found for this email",
        vendorId: existingOnboarding.id,
        onboarding: existingOnboarding,
      });
    }

    const onboarding = await prisma.vendorOnboarding.create({
      data: {
        orgName,
        address,
        email,
        contactPerson,
        contactNumber,
        orgType,
        specialties,
        plan,
        status: "DRAFT",
      },
    });

    return res.status(201).json(onboarding);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "A vendor onboarding draft already exists for this email" });
    }
    console.error("createVendorOnboarding error:", error);
    return res.status(500).json({ message: "Failed to create onboarding draft" });
  }
};

export const getVendorOnboarding = async (req: Request, res: Response) => {
  try {
    const vendorId = getVendorId(req.params);
    if (!vendorId) {
      return res.status(400).json({ message: "vendorId is required" });
    }

    const vendor = await prisma.vendorOnboarding.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor onboarding draft not found" });
    }

    return res.json(vendor);
  } catch (error) {
    console.error("getVendorOnboarding error:", error);
    return res.status(500).json({ message: "Failed to fetch onboarding draft" });
  }
};

export const findVendorOnboardingByEmail = async (req: Request, res: Response) => {
  try {
    const email = req.query.email;
    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      return res.status(400).json({ message: "A valid email query param is required" });
    }

    const vendor = await prisma.vendorOnboarding.findUnique({ where: { email } });
    if (!vendor) {
      return res.status(404).json({ message: "No onboarding draft found for this email" });
    }

    return res.json(vendor);
  } catch (error) {
    console.error("findVendorOnboardingByEmail error:", error);
    return res.status(500).json({ message: "Failed to fetch onboarding draft by email" });
  }
};

export const updateVendorOnboarding = async (req: Request, res: Response) => {
  try {
    const vendorId = getVendorId(req.params);
    if (!vendorId) {
      return res.status(400).json({ message: "vendorId is required" });
    }
    const updates: Record<string, any> = {};
    const allowedFields = ["orgName", "address", "email", "contactPerson", "contactNumber", "orgType", "specialties", "plan"];

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.email && !isValidEmail(updates.email)) {
      return res.status(400).json({ message: "Valid email is required" });
    }
    if (updates.contactNumber && !isValidContactNumber(updates.contactNumber)) {
      return res.status(400).json({ message: "Valid 10-digit contactNumber is required" });
    }
    if (updates.orgType && !validOrgTypes.has(updates.orgType)) {
      return res.status(400).json({ message: "orgType must be Hospital, Diagnostic Center or Specialty Clinic" });
    }
    if (updates.specialties && (!Array.isArray(updates.specialties) || updates.specialties.length === 0)) {
      return res.status(400).json({ message: "At least one specialty is recommended" });
    }
    if (updates.plan && !validPlans.has(updates.plan)) {
      return res.status(400).json({ message: "plan must be Standard, Pro or Premium" });
    }

    if (updates.email) {
      const duplicateEmail = await prisma.vendorOnboarding.findUnique({ where: { email: updates.email } });
      if (duplicateEmail && duplicateEmail.id !== vendorId) {
        return res.status(409).json({ message: "This email is already linked to another onboarding draft" });
      }
    }

    const currentVendor = await prisma.vendorOnboarding.findUnique({ where: { id: vendorId } });
    if (!currentVendor) {
      return res.status(404).json({ message: "Vendor onboarding draft not found" });
    }
    if (immutableOnboardingStatuses.has(currentVendor.status)) {
      return res.status(409).json({ message: "Onboarding is already under review or completed and cannot be updated" });
    }

    const vendor = await prisma.vendorOnboarding.update({
      where: { id: vendorId },
      data: updates,
    });

    return res.json(vendor);
  } catch (error: any) {
    console.error("updateVendorOnboarding error:", error);
    return res.status(500).json({ message: "Failed to update onboarding details" });
  }
};

export const presignVendorDocument = async (req: Request, res: Response) => {
  try {
    const vendorId = getVendorId(req.params);
    if (!vendorId) {
      return res.status(400).json({ message: "vendorId is required" });
    }
    const { documentType, fileName, contentType, fileSize } = req.body;

    if (!validDocumentTypes.has(documentType)) {
      return res.status(400).json({ message: "Invalid documentType" });
    }
    if (!fileName || typeof fileName !== "string") {
      return res.status(400).json({ message: "fileName is required" });
    }
    if (!contentType || typeof contentType !== "string") {
      return res.status(400).json({ message: "contentType is required" });
    }
    if (typeof fileSize !== "number" || fileSize <= 0) {
      return res.status(400).json({ message: "fileSize must be a positive number" });
    }
    if (!s3Bucket) {
      return res.status(500).json({ message: "S3 bucket is not configured" });
    }

    const vendor = await prisma.vendorOnboarding.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor onboarding draft not found" });
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileKey = `vendor-onboarding/${vendorId}/${documentType}/${Date.now()}_${safeFileName}`;

    const command = new PutObjectCommand({
      Bucket: s3Bucket,
      Key: fileKey,
      ContentType: contentType,
      ContentLength: fileSize,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    const publicUrl = `https://${s3Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;

    return res.json({ uploadUrl, fileKey, publicUrl });
  } catch (error) {
    console.error("presignVendorDocument error:", error);
    return res.status(500).json({ message: "Failed to generate presigned URL" });
  }
};

export const completeVendorDocument = async (req: Request, res: Response) => {
  try {
    const vendorId = getVendorId(req.params);
    if (!vendorId) {
      return res.status(400).json({ message: "vendorId is required" });
    }
    const { documentType, fileKey, fileName, contentType, fileSize } = req.body;

    if (!validDocumentTypes.has(documentType)) {
      return res.status(400).json({ message: "Invalid documentType" });
    }
    if (!fileKey || !fileName || !contentType || typeof fileSize !== "number") {
      return res.status(400).json({ message: "documentType, fileKey, fileName, contentType and fileSize are required" });
    }

    const vendor = await prisma.vendorOnboarding.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor onboarding draft not found" });
    }

    const existingDocuments = (vendor.documents as Record<string, any>) ?? {};
    const updatedDocuments = {
      ...existingDocuments,
      [documentType]: {
        fileKey,
        fileName,
        contentType,
        fileSize,
        uploadedAt: new Date().toISOString(),
      },
    };

    const nextStatus = getStatusAfterDocumentUpdate(updatedDocuments, vendor.paymentStatus ?? undefined);

    const updatedVendor = await prisma.vendorOnboarding.update({
      where: { id: vendorId },
      data: {
        documents: updatedDocuments,
        status: nextStatus,
      },
    });

    return res.json(updatedVendor);
  } catch (error) {
    console.error("completeVendorDocument error:", error);
    return res.status(500).json({ message: "Failed to complete document upload" });
  }
};

export const createRazorpayOrder = async (req: Request, res: Response) => {
  try {
    const vendorId = getVendorId(req.params);
    if (!vendorId) {
      return res.status(400).json({ message: "vendorId is required" });
    }
    const vendor = await prisma.vendorOnboarding.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor onboarding draft not found" });
    }

    const plan = vendor.plan;
    const amount = planAmountsInPaise[plan];
    if (!amount) {
      return res.status(400).json({ message: "Invalid onboarding plan for payment" });
    }

    if (vendor.paymentOrderId && vendor.paymentStatus === "PENDING") {
      return res.json({
        orderId: vendor.paymentOrderId,
        amount: planAmountsInPaise[vendor.plan] ?? amount,
        currency: "INR",
        razorpayKeyId,
        onboardingStatus: vendor.status,
      });
    }

    if (vendor.paymentStatus === "COMPLETED") {
      return res.status(409).json({
        message: "Payment is already completed for this onboarding",
        orderId: vendor.paymentOrderId,
        amount: planAmountsInPaise[vendor.plan] ?? amount,
        currency: "INR",
        razorpayKeyId,
        onboardingStatus: vendor.status,
      });
    }

    const razorpay = ensureRazorpayClient();
    const safeVendorId = vendorId.toString().slice(0, 20);
    const receipt = `vend-${safeVendorId}-${Date.now().toString().slice(-8)}`;
    const order = await new Promise<any>((resolve, reject) => {
      razorpay.orders.create(
        {
          amount,
          currency: "INR",
          receipt,
          payment_capture: true,
        },
        (error: any, result: any) => {
          if (error) {
            return reject(error);
          }
          resolve(result);
        }
      );
    });

    const updatedVendor = await prisma.vendorOnboarding.update({
      where: { id: vendorId },
      data: {
        paymentOrderId: order.id,
        paymentStatus: "PENDING",
        razorpayOrderId: order.id,
        status: vendor.status === "DRAFT" ? "PAYMENT_PENDING" : vendor.status,
      },
    });

    return res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      razorpayKeyId,
      onboardingStatus: updatedVendor.status,
    });
  } catch (error: any) {
    console.error("createRazorpayOrder error:", error);
    const razorpayMessage = error?.error?.description || error?.message || "Failed to create Razorpay order";
    return res.status(500).json({ message: razorpayMessage });
  }
};

export const verifyRazorpayPayment = async (req: Request, res: Response) => {
  try {
    const vendorId = getVendorId(req.params);
    if (!vendorId) {
      return res.status(400).json({ message: "vendorId is required" });
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "razorpay_order_id, razorpay_payment_id and razorpay_signature are required" });
    }

    const vendor = await prisma.vendorOnboarding.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor onboarding draft not found" });
    }
    if (!vendor.razorpayOrderId || vendor.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "Order ID mismatch" });
    }
    if (!razorpayKeySecret) {
      return res.status(500).json({ message: "Razorpay secret is not configured" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpay_signature))) {
      return res.status(400).json({ message: "Invalid Razorpay signature" });
    }

    const documents = (vendor.documents as Record<string, any>) ?? {};
    const hasAllDocs = [...validDocumentTypes].every((type) => Boolean(documents[type]));
    const nextStatus = hasAllDocs ? "UNDER_REVIEW" : "PAYMENT_COMPLETED";

    const updatedVendor = await prisma.vendorOnboarding.update({
      where: { id: vendorId },
      data: {
        paymentStatus: "COMPLETED",
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: nextStatus,
      },
    });

    return res.json({
      verified: true,
      status: updatedVendor.status,
      paymentStatus: updatedVendor.paymentStatus,
    });
  } catch (error) {
    console.error("verifyRazorpayPayment error:", error);
    return res.status(500).json({ message: "Failed to verify Razorpay payment" });
  }
};

export const submitVendorOnboarding = async (req: Request, res: Response) => {
  try {
    const vendorId = getVendorId(req.params);
    if (!vendorId) {
      return res.status(400).json({ message: "vendorId is required" });
    }
    const vendor = await prisma.vendorOnboarding.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor onboarding draft not found" });
    }

    const documents = (vendor.documents as Record<string, any>) ?? {};
    const hasAllDocs = [...validDocumentTypes].every((type) => Boolean(documents[type]));
    if (!hasAllDocs) {
      return res.status(400).json({ message: "All required documents must be uploaded before submission" });
    }
    if (vendor.paymentStatus !== "COMPLETED") {
      return res.status(400).json({ message: "Payment must be completed before submission" });
    }

    const updatedVendor = await prisma.vendorOnboarding.update({
      where: { id: vendorId },
      data: { status: "UNDER_REVIEW" },
    });

    return res.json(updatedVendor);
  } catch (error) {
    console.error("submitVendorOnboarding error:", error);
    return res.status(500).json({ message: "Failed to submit vendor onboarding" });
  }
};

export const getVendorStatus = async (req: Request, res: Response) => {
  try {
    const vendorId = getVendorId(req.params);
    if (!vendorId) {
      return res.status(400).json({ message: "vendorId is required" });
    }
    const vendor = await prisma.vendorOnboarding.findUnique({
      where: { id: vendorId },
      select: { id: true, status: true, paymentStatus: true, plan: true, orgName: true },
    });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor onboarding draft not found" });
    }

    return res.json(vendor);
  } catch (error) {
    console.error("getVendorStatus error:", error);
    return res.status(500).json({ message: "Failed to retrieve vendor onboarding status" });
  }
};
