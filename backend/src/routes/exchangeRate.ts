import { FastifyInstance } from "fastify";
import { getUsdEurRate, getUsdPlnRate } from "../services/exchangeRateService";

// Public — the landing site and the app read the current USD→PLN rate to show
// prices in zł for Polish users.
export async function exchangeRateRoutes(app: FastifyInstance) {
  app.get("/api/exchange-rate", async (_request, reply) => {
    const [data, eur] = await Promise.all([getUsdPlnRate(), getUsdEurRate()]);
    return reply.send({
      success: true,
      data: {
        // `rate` = PLN per USD (kept for the mobile app); `rates` has every currency
        rates: { pln: data.rate, eur: eur.rate },
        rate: data.rate,
        effectiveDate: data.effectiveDate,
        tableNo: data.tableNo,
      },
    });
  });
}
