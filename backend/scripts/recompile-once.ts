import "dotenv/config";
import { enqueueGeneration } from "../src/lib/jobQueue";
(async () => {
  const r = await enqueueGeneration("compile", "cmrovex220001vtt0dr8sw38w");
  console.log("RECOMPILE:", JSON.stringify(r));
  setTimeout(() => process.exit(0), 1500);
})();
