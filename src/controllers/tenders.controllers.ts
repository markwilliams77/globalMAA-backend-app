// controllers/tenders.controller.ts
import { Request, Response } from "express";
import { prisma } from "../configs/db";

 export const createTender = async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.role !== "ADMIN") {
    return res.status(403).json({ message: "Only admin can create tenders" });
  }

  const { title, description } = req.body;

  const tender = await prisma.tender.create({
    data: {
      title,
      description,
      createdBy: user.id
    }
  });

  res.json(tender);
};

// Everyone authenticated: list tenders
export const getTenders = async (req: Request, res: Response) => {
  const tenders = await prisma.tender.findMany({
    orderBy: { createdAt: "desc" }
  });

  res.json(tenders);
};

// Get single tender
export const getTenderById = async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!id) {
    return res.status(400).json({ message: "Tender id is required" });
  }

  const tender = await prisma.tender.findUnique({
    where: { id }
  });

  if (!tender) {
    return res.status(404).json({ message: "Tender not found" });
  }

  res.json(tender);
};
