import { Request, Response } from "express";
import { prisma } from "../../configs/db";

const DEFAULT_VENDOR_IMAGE = "https://via.placeholder.com/800";

const isStatsRecord = (value: unknown): value is Record<string, string> => {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((item) => typeof item === "string")
  );
};

export const getVendorDetails = async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!id) {
    return res.status(400).json({ message: "Vendor id is required" });
  }

  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
    });

    if (!vendor || vendor.status !== "APPROVED") {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const primaryService = vendor.services[0] ?? "Healthcare Provider";

    res.json({
      id: vendor.id,
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
      stats: isStatsRecord(vendor.stats)
        ? vendor.stats
        : {
            patientsTreated: "10,000+",
            countriesReached: "50+",
          },
      staffCount: vendor.staffCount ?? "500",
    });
  } catch (error) {
    console.error("Failed to fetch vendor details:", error);
    res.status(500).json({ message: "Failed to fetch vendor details" });
  }
};
