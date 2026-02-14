function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background-color:#4f46e5;padding:24px;text-align:center;">
          <div style="display:inline-block;width:40px;height:40px;background-color:rgba(255,255,255,0.2);border-radius:10px;line-height:40px;font-size:20px;font-weight:bold;color:#ffffff;">M</div>
          <div style="color:#ffffff;font-size:20px;font-weight:600;margin-top:8px;">MindFlow</div>
        </td></tr>
        <tr><td style="padding:32px 24px;">
          ${content}
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #e4e4e7;text-align:center;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;">MindFlow - Your voice-first AI assistant</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function verificationEmailHtml(name: string, verifyUrl: string): string {
  return baseLayout(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#18181b;">Verify your email</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#3f3f46;line-height:1.6;">
      Hi ${name}, welcome to MindFlow! Please verify your email address by clicking the button below.
    </p>
    <a href="${verifyUrl}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;">
      Verify Email
    </a>
    <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;line-height:1.5;">
      This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
    </p>
  `);
}

export function passwordResetEmailHtml(name: string, resetUrl: string): string {
  return baseLayout(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#18181b;">Reset your password</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#3f3f46;line-height:1.6;">
      Hi ${name}, we received a request to reset your password. Click the button below to choose a new one.
    </p>
    <a href="${resetUrl}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;">
      Reset Password
    </a>
    <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;line-height:1.5;">
      This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
    </p>
  `);
}
