/**
 * Image storage. Uses Cloudinary when configured; otherwise writes to local disk
 * (development only). Only the resulting URL is stored in PostgreSQL.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
import { badRequest } from "../utils/errors.js";

const useCloudinary = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
if (useCloudinary) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export const UPLOAD_DIR = path.resolve("uploads");

/** Detects the real image type from magic bytes; never trust the client-provided MIME type. */
export function sniffImageType(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export function validateImage(buf: Buffer) {
  const type = sniffImageType(buf);
  if (!type) throw badRequest("Unsupported image. Upload a JPEG, PNG or WebP photo.");
  return type;
}

export async function storeImage(userId: string, buf: Buffer, type: string): Promise<string> {
  if (useCloudinary) {
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: `fitpulse/${userId}`, resource_type: "image", transformation: [{ width: 1280, height: 1280, crop: "limit", quality: "auto", fetch_format: "auto" }] },
          (err, res) => (err || !res ? reject(err) : resolve(res as { secure_url: string })),
        )
        .end(buf);
    });
    return result.secure_url;
  }
  const ext = type.split("/")[1];
  const dir = path.join(UPLOAD_DIR, userId);
  await fs.mkdir(dir, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, name), buf);
  return `${process.env.PUBLIC_API_URL ?? `http://localhost:${env.PORT}`}/uploads/${userId}/${name}`;
}

export async function deleteUserImages(userId: string) {
  if (useCloudinary) {
    await cloudinary.api.delete_resources_by_prefix(`fitpulse/${userId}/`).catch(() => undefined);
  } else {
    await fs.rm(path.join(UPLOAD_DIR, userId), { recursive: true, force: true });
  }
}
