// One-off: mark the newest unpaid project as PAID (webhook was missing when
// the checkout completed) and enqueue structure generation — mirrors the
// checkout.session.completed handler in routes/webhooks.ts.
require("dotenv").config();

(async () => {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const p = await prisma.project.findFirst({
    where: { paymentStatus: { not: "PAID" } },
    orderBy: { createdAt: "desc" },
  });
  if (!p) {
    console.log("no unpaid project found");
    process.exit(1);
  }
  console.log("project:", p.id, "|", p.title, "|", p.paymentStatus, "|", p.currentStage);
  await prisma.project.update({
    where: { id: p.id },
    data: { paymentStatus: "PAID", paidAt: new Date(), currentStage: "STRUCTURE" },
  });
  console.log("marked PAID, stage STRUCTURE");
  const { enqueueGeneration } = require("../dist/lib/jobQueue");
  const result = await enqueueGeneration("structure", p.id);
  console.log("enqueue:", JSON.stringify(result));
  await prisma.$disconnect();
  setTimeout(() => process.exit(0), 1500);
})();
