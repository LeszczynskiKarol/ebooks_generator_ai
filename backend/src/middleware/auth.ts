import { FastifyRequest, FastifyReply } from "fastify";

export interface JwtPayload {
  userId: string;
  email: string;
  type: string;
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ success: false, error: "Unauthorized" });
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
