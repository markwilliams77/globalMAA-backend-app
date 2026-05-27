import express from "express";
import { prisma } from "../configs/db";
import { sendOTP, verifyOTP } from "../services/otpService";

const router = express.Router();

const normalizeIndianPhoneNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  return phone.trim();
};

const getPhoneMatches = (rawPhone: string, normalizedPhone: string) => {
  const trimmedPhone = rawPhone.trim();

  return trimmedPhone && trimmedPhone !== normalizedPhone
    ? [{ phone: normalizedPhone }, { phone: trimmedPhone }]
    : [{ phone: normalizedPhone }];
};

router.post("/send-otp", async (req, res) => {
  const rawPhone = typeof req.body.phone === "string" ? req.body.phone.trim() : "";
  const phone = rawPhone ? normalizeIndianPhoneNumber(rawPhone) : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim() : undefined;
  const mode = req.body.mode === "signup" || email ? "signup" : "login";

  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  try {
    if (mode === "login") {
      const existingLead = await prisma.otpLead.findFirst({
        where: {
          OR: getPhoneMatches(rawPhone, phone),
        },
      });

      if (!existingLead) {
        return res.status(404).json({ error: "Phone number is not registered" });
      }

      await sendOTP(phone);

      await prisma.otpLead.update({
        where: { phone: existingLead.phone },
        data: {
          otpSendCount: { increment: 1 },
          lastOtpSentAt: new Date(),
        },
      });

      return res.json({ message: "OTP sent" });
    }

    const existingLead = await prisma.otpLead.findFirst({
      where: {
        OR: [
          ...getPhoneMatches(rawPhone, phone),
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (existingLead) {
      const phoneAlreadyRegistered = existingLead.phone === phone;
      const emailAlreadyRegistered = Boolean(email && existingLead.email === email);

      if (phoneAlreadyRegistered && emailAlreadyRegistered) {
        return res.status(409).json({ error: "Phone number and email are already registered" });
      }

      if (phoneAlreadyRegistered) {
        return res.status(409).json({ error: "Phone number is already registered" });
      }

      return res.status(409).json({ error: "Email is already registered" });
    }

    await sendOTP(phone);

    await prisma.otpLead.create({
      data: {
        phone,
        email,
        otpSendCount: 1,
      },
    });

    res.json({ message: "OTP sent" });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const fields = Array.isArray(err.meta?.target) ? err.meta.target : [];
      const isEmailConflict = fields.includes("email");

      return res.status(409).json({
        error: isEmailConflict ? "Email is already registered" : "Phone number is already registered",
      });
    }

    console.error("OTP Error:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

router.post("/verify-otp", async (req, res) => {
  const rawPhone = typeof req.body.phone === "string" ? req.body.phone.trim() : "";
  const phone = rawPhone ? normalizeIndianPhoneNumber(rawPhone) : "";
  const code = typeof req.body.code === "string" ? req.body.code.trim() : "";

  if (!phone || !code) {
    return res.status(400).json({ error: "Phone + code required" });
  }

  try {
    const response = await verifyOTP(phone, code);
    const verified = response.status === "approved";

    if (verified) {
      await prisma.otpLead.updateMany({
        where: {
          OR: getPhoneMatches(rawPhone, phone),
        },
        data: { verifiedAt: new Date() },
      });
    }

    res.json({
      verified,
    });
  } catch (err) {
    console.error("OTP Error:", err);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

export default router;
