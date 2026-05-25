import { Request, Response } from "express";
import { prisma } from "../../configs/db";

const DEFAULT_VENDOR_IMAGE = "https://via.placeholder.com/800";

const toPositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const mapVendorListItem = (vendor: {
  id: string;
  companyName: string;
  region: string;
  services: string[];
  image: string | null;
  accreditation: string[];
  startingPrice: string | null;
  category: string | null;
  specialty: string | null;
  rating: number | null;
}) => {
  const primaryService = vendor.services[0] ?? "Healthcare Provider";

  return {
    id: vendor.id,
    name: vendor.companyName,
    location: vendor.region,
    category: vendor.category ?? primaryService,
    image: vendor.image ?? DEFAULT_VENDOR_IMAGE,
    accreditation: vendor.accreditation.length > 0 ? vendor.accreditation : ["Verified Provider"],
    startingPrice: vendor.startingPrice ?? "Contact for pricing",
    specialty: vendor.specialty ?? primaryService,
    rating: vendor.rating ?? 4.8,
  };
};

export const getDirectoryVendors = async (req: Request, res: Response) => {
  const { search, category, region } = req.query;
  const page = toPositiveInt(req.query.page, 1);
  const limit = Math.min(toPositiveInt(req.query.limit, 10), 50);
  const searchText = typeof search === "string" ? search.trim() : "";
  const categoryText = typeof category === "string" ? category.trim() : "";
  const regionText = typeof region === "string" ? region.trim() : "";

  try {
    const where = {
      status: "APPROVED" as const,
      ...(searchText && {
        OR: [
          { companyName: { contains: searchText, mode: "insensitive" as const } },
          { specialty: { contains: searchText, mode: "insensitive" as const } },
          { category: { contains: searchText, mode: "insensitive" as const } },
          { services: { has: searchText } },
        ],
      }),
      ...(categoryText && {
        OR: [{ category: categoryText }, { services: { has: categoryText } }],
      }),
      ...(regionText && regionText !== "Global" && {
        region: regionText,
      }),
    };

    const [vendors, total] = await prisma.$transaction([
      prisma.vendor.findMany({
        where,
        select: {
          id: true,
          companyName: true,
          region: true,
          services: true,
          image: true,
          accreditation: true,
          startingPrice: true,
          category: true,
          specialty: true,
          rating: true,
        },
        orderBy: { companyName: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.vendor.count({ where }),
    ]);

    res.json({
      data: vendors.map(mapVendorListItem),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch directory vendors:", error);
    res.status(500).json({ message: "Failed to fetch vendors" });
  }
};
