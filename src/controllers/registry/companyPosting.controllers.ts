import { Prisma, VendorStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { Request, Response } from "express";
import { prisma } from "../../configs/db";

const bcrypt = require("bcrypt") as {
  hash(data: string, saltOrRounds: number): Promise<string>;
};

const DEFAULT_VENDOR_IMAGE = "https://via.placeholder.com/800";
const VALID_VENDOR_STATUSES = new Set<VendorStatus>(["PENDING", "APPROVED", "REJECTED"]);

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
};

const toCleanStringArray = (value: unknown) => {
  if (!isStringArray(value)) {
    return [];
  }

  return value.map((item) => item.trim()).filter(Boolean);
};

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const getStringValue = (value: unknown) => {
  return typeof value === "string" ? value.trim() : "";
};

const getOptionalStringValue = (value: unknown) => {
  const text = getStringValue(value);

  return text || undefined;
};

const getRating = (value: unknown) => {
  const rating = Number(value);

  if (!Number.isFinite(rating)) {
    return undefined;
  }

  return Math.min(Math.max(rating, 0), 5);
};

const getStats = (value: unknown): Prisma.InputJsonObject | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => typeof item === "string")
      .map(([key, item]) => [key, item])
  ) as Prisma.InputJsonObject;
};

const getVendorStatus = (value: unknown) => {
  const status = getStringValue(value).toUpperCase() as VendorStatus;

  return VALID_VENDOR_STATUSES.has(status) ? status : "APPROVED";
};

const mapCreatedVendor = (vendor: {
  id: string;
  companyName: string;
  region: string;
  category: string | null;
  specialty: string | null;
  services: string[];
  rating: number | null;
  image: string | null;
  description: string | null;
  accreditation: string[];
  startingPrice: string | null;
  stats: Prisma.JsonValue;
  staffCount: string | null;
  status: VendorStatus;
  user: {
    id: string;
    email: string;
  };
}) => {
  const primaryService = vendor.services[0] ?? "Healthcare Provider";

  return {
    id: vendor.id,
    userId: vendor.user.id,
    email: vendor.user.email,
    status: vendor.status,
    name: vendor.companyName,
    location: vendor.region,
    category: vendor.category ?? primaryService,
    specialty: vendor.specialty ?? primaryService,
    rating: vendor.rating ?? 4.8,
    image: vendor.image ?? DEFAULT_VENDOR_IMAGE,
    description: vendor.description ?? "",
    fullServices: vendor.services,
    accreditation: vendor.accreditation.length > 0 ? vendor.accreditation : ["Verified Provider"],
    startingPrice: vendor.startingPrice ?? "Contact for pricing",
    stats: vendor.stats ?? {
      patientsTreated: "10,000+",
      countriesReached: "50+",
    },
    staffCount: vendor.staffCount ?? "500",
  };
};

export const createRegistryCompany = async (req: Request, res: Response) => {
  const companyName = getStringValue(req.body.companyName ?? req.body.name);
  const region = getStringValue(req.body.region ?? req.body.location);
  const services = toCleanStringArray(req.body.services ?? req.body.fullServices);

  if (!companyName || !region || services.length === 0) {
    return res.status(400).json({
      message: "companyName, region, and services are required",
    });
  }

  const email =
    getOptionalStringValue(req.body.email) ??
    `${slugify(companyName) || "vendor"}-${Date.now()}@registry.globalmaa.local`;
  const password = getOptionalStringValue(req.body.password) ?? randomUUID();
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const vendor = await prisma.vendor.create({
      data: {
        companyName,
        region,
        services,
        description: getOptionalStringValue(req.body.description),
        image: getOptionalStringValue(req.body.image),
        rating: getRating(req.body.rating),
        accreditation: toCleanStringArray(req.body.accreditation),
        startingPrice: getOptionalStringValue(req.body.startingPrice),
        category: getOptionalStringValue(req.body.category) ?? services[0],
        specialty: getOptionalStringValue(req.body.specialty) ?? services[0],
        stats: getStats(req.body.stats),
        staffCount: getOptionalStringValue(req.body.staffCount),
        status: getVendorStatus(req.body.status),
        user: {
          create: {
            email,
            password: hashedPassword,
            role: "VENDOR",
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json(mapCreatedVendor(vendor));
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "A vendor user with this email already exists" });
    }

    console.error("Failed to create registry company:", error);
    res.status(500).json({ message: "Failed to create registry company" });
  }
};
