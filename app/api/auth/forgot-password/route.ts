import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { passwordResetEmailHtml } from "@/lib/email-templates";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ message: "If an account exists, we've sent a reset link." });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (user) {
      // Delete any existing password reset tokens for this user
      await prisma.verificationToken.deleteMany({
        where: { userId: user.id, type: "password_reset" },
      });

      const token = crypto.randomUUID();
      await prisma.verificationToken.create({
        data: {
          userId: user.id,
          token,
          type: "password_reset",
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      await sendEmail({
        to: user.email,
        subject: "Reset your MindFlow password",
        html: passwordResetEmailHtml(user.name || "there", resetUrl),
      });
    }

    // Always return 200 to not reveal if email exists
    return NextResponse.json({ message: "If an account exists, we've sent a reset link." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ message: "If an account exists, we've sent a reset link." });
  }
}
