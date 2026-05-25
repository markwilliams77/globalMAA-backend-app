import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET as string;

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

export const signToken = (payload: any) => {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, SECRET);
}; 