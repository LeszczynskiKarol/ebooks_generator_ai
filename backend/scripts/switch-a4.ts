import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { enqueueGeneration } from "../src/lib/jobQueue";
(async () => {
  await prisma.project.update({ where: { id: "cmrovex220001vtt0dr8sw38w" }, data: { bookFormat: "a4" } });
  const r = await enqueueGeneration("compile", "cmrovex220001vtt0dr8sw38w");
  console.log("A4 RECOMPILE:", JSON.stringify(r));
  setTimeout(() => process.exit(0), 1500);
})();
