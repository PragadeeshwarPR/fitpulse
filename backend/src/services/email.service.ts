import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

const layout = (title: string, body: string, cta?: { href: string; label: string }) => `
<div style="background:#080B0A;padding:32px;font-family:Inter,Arial,sans-serif;color:#fff">
  <div style="max-width:480px;margin:auto;background:#151D18;border-radius:16px;padding:32px">
    <h1 style="color:#39FF78;margin:0 0 16px;font-size:22px">FitPulse</h1>
    <h2 style="margin:0 0 12px;font-size:18px">${title}</h2>
    <p style="color:#A3ADA6;line-height:1.6">${body}</p>
    ${
      cta
        ? `<a href="${cta.href}" style="display:inline-block;margin-top:16px;background:#39FF78;color:#080B0A;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${cta.label}</a>`
        : ""
    }
  </div>
</div>`;

async function send(to: string, subject: string, html: string, text: string) {
  if (!transporter) {
    if (env.NODE_ENV !== "test") console.info(`\n[email:dev] to=${to}\nsubject=${subject}\n${text}\n`);
    return;
  }
  await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html, text });
}

export function sendVerificationEmail(to: string, name: string, token: string) {
  const link = `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  return send(
    to,
    "Verify your FitPulse email",
    layout(`Welcome, ${escapeHtml(name)}!`, "Confirm your email address to secure your account.", {
      href: link,
      label: "Verify email",
    }),
    `Verify your email: ${link}`,
  );
}

export function sendPasswordResetEmail(to: string, token: string) {
  const link = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  return send(
    to,
    "Reset your FitPulse password",
    layout("Password reset", "This link expires in 1 hour. If you didn't request it, ignore this email.", {
      href: link,
      label: "Reset password",
    }),
    `Reset your password (expires in 1 hour): ${link}`,
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
