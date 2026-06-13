// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Project images — shared between the PDF (bookCompiler) and EPUB
// (epubCompiler) pipelines. Downloads uploaded images from S3 (or the
// local uploads fallback) into <targetDir>/images and returns a map
// from the original s3Url to the relative local path, so chapter LaTeX
// can be rewritten to reference packaged files instead of remote URLs.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import * as fs from "fs";
import * as path from "path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "./prisma";

export async function downloadProjectImages(
  projectId: string,
  targetDir: string,
): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();

  const images = await prisma.projectImage.findMany({
    where: { projectId, source: { in: ["USER_UPLOAD", "AI_GENERATED"] } },
    select: {
      id: true,
      s3Key: true,
      s3Url: true,
      originalName: true,
      format: true,
    },
  });

  if (images.length === 0) return imageMap;

  const imagesDir = path.join(targetDir, "images");
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

  for (const img of images) {
    const ext = img.format
      ? `.${img.format}`
      : path.extname(img.originalName || ".jpg");
    const localName = `img-${img.id.substring(0, 12)}${ext}`;
    const localPath = path.join(imagesDir, localName);

    try {
      if (process.env.AWS_ACCESS_KEY_ID && process.env.S3_BUCKET) {
        const s3 = new S3Client({
          region: process.env.AWS_REGION || "eu-north-1",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });
        const response = await s3.send(
          new GetObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: img.s3Key,
          }),
        );
        const chunks: Buffer[] = [];
        for await (const chunk of response.Body as any) {
          chunks.push(Buffer.from(chunk));
        }
        fs.writeFileSync(localPath, Buffer.concat(chunks));
      } else {
        const localUploadPath = path.join(
          process.cwd(),
          "tmp",
          "uploads",
          projectId,
          path.basename(img.s3Key),
        );
        if (fs.existsSync(localUploadPath)) {
          fs.copyFileSync(localUploadPath, localPath);
        } else {
          console.warn(`  ⚠️ Image not found locally: ${localUploadPath}`);
          continue;
        }
      }
      if (img.s3Url) imageMap.set(img.s3Url, `images/${localName}`);
      console.log(`  🖼️  Downloaded: ${img.originalName} → ${localName}`);
    } catch (err) {
      console.error(`  ⚠️ Failed to download image ${img.originalName}:`, err);
    }
  }
  return imageMap;
}

/** Replace remote image URLs in LaTeX with their packaged local paths. */
export function rewriteImageUrls(
  latex: string,
  imageMap: Map<string, string>,
): string {
  let result = latex;
  for (const [url, localPath] of imageMap) {
    result = result.split(url).join(localPath);
    console.log(`  🖼️  Map: ${url.substring(0, 80)}... → ${localPath}`);
  }
  return result;
}
