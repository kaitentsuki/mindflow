import { Resend } from "resend";

const FROM_ADDRESS = process.env.RESEND_FROM || "MindFlow <noreply@mindflow.app>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });
  } else {
    console.log(`[Email Stub] To: ${to}, Subject: ${subject}`);
    console.log(html);
  }
}
