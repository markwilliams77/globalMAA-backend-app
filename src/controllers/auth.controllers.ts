// controllers/auth.controllers.ts
import { Request, Response } from "express";
import { prisma } from "../configs/db";
import { signToken } from "../utils/jwt";
import vendorLoginService from "../services/vendorLogin.service";

const bcrypt = require("bcrypt") as {
  compare(data: string, encrypted: string): Promise<boolean>;
};
export const getProfile = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { vendor: true }
  });

  res.json(user);
};

export const updateProfile = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { email } = req.body;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { email }
  });

  res.json(updated);
};

export const vendorLogin = async (req: Request, res: Response) => {
  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  try {
    const loginInfo: any = await vendorLoginService.findVendorLoginByUsername(username);

    if (!loginInfo) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (loginInfo.status !== "ACTIVE") {
      return res.status(403).json({ message: "Vendor login is not active" });
    }

    const passwordMatches = await bcrypt.compare(password, loginInfo.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // fetch onboarding details for convenience
    const vendorOnboarding = await prisma.vendorOnboarding.findUnique({
      where: { id: loginInfo.vendorOnboardingId },
    });

    const token = signToken({
      id: loginInfo.id,
      username: loginInfo.username,
      vendorOnboardingId: loginInfo.vendorOnboardingId,
      role: "VENDOR",
    });

    return res.json({
      token,
      vendor: {
        id: loginInfo.id,
        username: loginInfo.username,
        status: loginInfo.status,
        vendorOnboardingId: loginInfo.vendorOnboardingId,
        vendorOnboarding,
      },
    });
  } catch (error) {
    console.error("vendorLogin error:", error);
    return res.status(500).json({ message: "Failed to login vendor" });
  }
};