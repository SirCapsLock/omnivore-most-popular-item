import { FastifyRequest } from "fastify";
import { Knex } from "knex";
import { LocationService } from "../services/location.service";
import { addDays, format } from "date-fns";

export class LocationController {
  private locationService: LocationService;

  public constructor(private db: Knex) {
    this.locationService = new LocationService(db);
  }

  public seed(req: FastifyRequest, res: any) {
    const locationId = (req.params as any).locationId;
    return this.locationService.seed(locationId);
  }

  public getMostPopularItem(req: FastifyRequest, res: any) {
    const query = req.query as any;
    const params = req.params as any;
    const locationId = params.locationId;
    let startDate = query.startDate;
    let endDate = query.endDate;

    if (!startDate) {
      // default startDate to 30 days before today
      startDate = format(addDays(new Date(), -30), "yyyy-LL-dd");
    }

    if (!endDate) {
      // default endDate to today
      endDate = format(new Date(), "yyyy-LL-dd");
    }

    return this.locationService.getMostPopularItem(
      locationId,
      startDate,
      endDate
    );
  }
}
