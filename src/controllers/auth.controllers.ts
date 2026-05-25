// controllers/auth.controllers.ts
import { Request, Response } from "express";
import { prisma } from "../configs/db";

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