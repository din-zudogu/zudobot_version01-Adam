import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const { GET, POST } = NextAuth(authOptions).handlers;
