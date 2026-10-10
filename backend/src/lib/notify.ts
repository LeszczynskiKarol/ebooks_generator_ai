// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// User notifications: one call creates the in-app row (read by web and the
// mobile app via GET /api/notifications) AND sends the matching email.
// Fire-and-forget from pipeline code — a notification failure must never
// break generation.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { projectLang } from "./email";
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
        uiLang: true,
        autoPilot: true,
        user: { select: { id: true, email: true } },
      },
    });
    if (!project || project.autoPilot || !project.user) return;

    const lang = projectLang(project);
    const bookName = project.title || project.topic;
    const title = { pl: "Plan książki gotowy do zatwierdzenia", en: "Book plan ready for your approval", de: "Gliederung bereit zur Freigabe" }[lang];
    const body = {
      pl: `„${bookName}”: przejrzyj rozdziały i zatwierdź plan, aby ruszyło pisanie.`,
      en: `"${bookName}": review the chapters and approve the plan to start the writing.`,
      de: `„${bookName}“: Prüfen Sie die Kapitel und geben Sie die Gliederung frei, damit das Schreiben beginnt.`,
    }[lang];

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
      lang,
    );
  } catch (err: any) {
    console.error(`🔔 notifyStructureReady(${projectId}) failed: ${err.message}`);
  }
}

/**
 * The book finished compiling — PDF (and usually EPUB) are ready to download.
 * Sent only for the FIRST completed version: recompiles after user edits give
 * new versions of a book the user already has, and a fresh "your book is
 * ready" for each of them would read as spam. Autopilot books have no waiting
 * customer, so they are skipped the same way as in notifyStructureReady.
 */
export async function notifyBookCompleted(projectId: string): Promise<void> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        topic: true,
        language: true,
        uiLang: true,
        autoPilot: true,
        user: { select: { id: true, email: true } },
      },
    });
    if (!project || project.autoPilot || !project.user) return;

    const lang = projectLang(project);
    const bookName = project.title || project.topic;
    const title = { pl: "Twoja książka jest gotowa", en: "Your book is ready", de: "Ihr Buch ist fertig" }[lang];
    const body = {
      pl: `„${bookName}”: PDF i EPUB czekają do pobrania.`,
      en: `"${bookName}": the PDF and EPUB are ready to download.`,
      de: `„${bookName}“: PDF und EPUB stehen zum Download bereit.`,
    }[lang];

    await prisma.notification.create({
      data: {
        userId: project.user.id,
        type: "book_completed",
        title,
        body,
        projectId: project.id,
      },
    });

    const { sendBookCompletedEmail } = await import("./email");
    await sendBookCompletedEmail(
      project.user.email,
      bookName,
      `${APP_URL}/projects/${project.id}`,
      lang,
    );
  } catch (err: any) {
    console.error(`🔔 notifyBookCompleted(${projectId}) failed: ${err.message}`);
  }
}
