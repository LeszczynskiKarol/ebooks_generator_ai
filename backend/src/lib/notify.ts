// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// User notifications: one call creates the in-app row (read by web and the
// mobile app via GET /api/notifications) AND sends the matching email.
// Fire-and-forget from pipeline code — a notification failure must never
// break generation.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { prisma } from "./prisma";
import { sendStructureReadyEmail } from "./email";

const APP_URL = process.env.PUBLIC_APP_URL || "https://app.inkmagnet.com";

/**
 * The book's structure is waiting for the owner's approval
 * (currentStage = STRUCTURE_REVIEW). Skipped for autopilot projects —
 * nobody reviews those.
 */
export async function notifyStructureReady(projectId: string): Promise<void> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        topic: true,
        language: true,
        autoPilot: true,
        user: { select: { id: true, email: true } },
      },
    });
    if (!project || project.autoPilot || !project.user) return;

    const pl = project.language === "pl";
    const bookName = project.title || project.topic;
    const title = pl
      ? "Plan książki gotowy do zatwierdzenia"
      : "Book plan ready for your approval";
    const body = pl
      ? `„${bookName}" — przejrzyj rozdziały i zatwierdź plan, aby ruszyło pisanie.`
      : `"${bookName}" — review the chapters and approve the plan to start the writing.`;

    await prisma.notification.create({
      data: {
        userId: project.user.id,
        type: "structure_ready",
        title,
        body,
        projectId: project.id,
      },
    });

    await sendStructureReadyEmail(
      project.user.email,
      bookName,
      `${APP_URL}/projects/${project.id}`,
      pl ? "pl" : "en",
    );
  } catch (err: any) {
    console.error(`🔔 notifyStructureReady(${projectId}) failed: ${err.message}`);
  }
}
