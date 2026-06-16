import { FastifyInstance } from "fastify";
import { getUsdPlnRate } from "../services/exchangeRateService";

// Public — the landing site and the app read the current USD→PLN rate to show
// prices in zł for Polish users.
export async function exchangeRateRoutes(app: FastifyInstance) {
  app.get("/api/exchange-rate", async (_request, reply) => {
    const data = await getUsdPlnRate();
    return reply.send({
      success: true,
      data: {
        rate: data.rate,
        effectiveDate: data.effectiveDate,
        tableNo: data.tableNo,
      },
    });
  });
}
