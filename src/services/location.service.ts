import axios, { Method } from "axios";
import { Knex } from "knex";
import { format, fromUnixTime } from "date-fns";

export class LocationService {
  public constructor(private db: Knex) {}

  public async seed(locationId: string) {
    let omniResponse = await this.omniRequest(
      "GET",
      `locations/${locationId}/tickets`,
      ["closed_at", "@items(name,quantity,menu_item)"],
      "eq(open,false)",
      1
    );

    const tickets = omniResponse._embedded.tickets;
    await this.storeQuantitiesSold(locationId, tickets);
    while (omniResponse._links && omniResponse._links.next) {
      console.log("processing NEXT:", omniResponse._links.next.href);
      omniResponse = await axios.get(omniResponse._links.next.href, {
        headers: {
          "API-Key": process.env.OMNIVORE_API_KEY,
        },
      });
      omniResponse = omniResponse.data;
      await this.storeQuantitiesSold(
        locationId,
        omniResponse._embedded.tickets
      );
    }

    const response = { success: true };
    return response;
  }

  public getMostPopularItem(
    locationId: string,
    startDate: string,
    endDate: string
  ) {
    const subQuery = this.db
      .select("item_id", "item_name", this.db.raw("SUM(quantity_sold) as qty"))
      .from("omni.item_sales")
      .where("location_id", locationId)
      .andWhere("date", ">=", startDate)
      .andWhere("date", "<=", endDate)
      .groupBy("item_id", "item_name")
      .as("sales");
    return this.db
      .select("*")
      .from(subQuery)
      .orderBy("sales.qty", "desc")
      .limit(1)
      .first();
  }

  private async storeQuantitiesSold(locationId: string, tickets: any[]) {
    if (Array.isArray(tickets)) {
      for (let ticket of tickets) {
        const items = ticket._embedded.items;
        const closeDate = format(fromUnixTime(ticket.closed_at), "yyyy-LL-dd");
        const currentItemsSoldForDate = await this.db("omni.item_sales")
          .select(
            this.db.raw("date::date"),
            "location_id",
            "item_id",
            "item_name"
          )
          .where("location_id", locationId)
          .andWhere("date", closeDate);

        for (let item of items) {
          const name = item.name;
          const quantity = item.quantity;
          const itemId = item._embedded.menu_item.id;

          const shouldUpdate = currentItemsSoldForDate.some(
            (c: any) => c.item_id === itemId
          );
          if (shouldUpdate) {
            await this.db("omni.item_sales")
              .update({
                quantity_sold: this.db.raw(`quantity_sold + ${quantity}`),
              })
              .where("location_id", locationId)
              .andWhere("item_id", itemId);
          } else {
            await this.db("omni.item_sales").insert({
              date: closeDate,
              location_id: locationId,
              item_id: itemId,
              item_name: name,
              quantity_sold: quantity,
            });
          }
        }
      }
    }
  }

  private async omniRequest(
    method: Method,
    path: string,
    fields: string[] = [],
    where: string = "",
    limit: number = 50
  ) {
    let url = `https://api.omnivore.io/1.0/${path}?`;
    url += `limit=${limit}`;
    url += `&fields=${fields.join(",")}`;
    url += `&where=${where}`;

    console.log(`[OMNIVORE] ${method} ${url}`);

    const response = await axios(url, {
      method,
      headers: {
        "API-Key": process.env.OMNIVORE_API_KEY,
      },
    });

    return response.data;
  }
}
