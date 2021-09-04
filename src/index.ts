import { fastify, FastifyRequest } from "fastify";
import Knex from "knex";
import axios, { Method } from "axios";
import { format, fromUnixTime, getUnixTime } from "date-fns";

const OMNIVORE_API_URL: string = "https://api.omnivore.io/1.0";
const OMNIVORE_API_KEY: string = "8aa4572037ab4ebdb62fed0120c07ac3";
const PORT: number = 9000;
const app = fastify({
  ignoreTrailingSlash: true,
});

const db = Knex({
  client: "pg",
  connection: {
    host: "localhost",
    user: "postgres",
    password: "password",
    database: "postgres",
  },
});
db.on("query", (q) =>
  console.log("Executing: ", q.sql, " bindings: ", q.bindings)
);

const start = async () => {
  console.log(`Omni App Listening on port ${PORT}`);
  await app.listen(PORT, "0.0.0.0");
};

app.post("/locations/:locationId/seed", async (req, res) => {
  const locationId = (req.params as any).locationId;
  let omniResponse = await omniRequest(
    "GET",
    `locations/${(req.params as any).locationId}/tickets`,
    ["closed_at", "@items(name,quantity,menu_item)"],
    "eq(open,false)",
    1
  );

  const tickets = omniResponse._embedded.tickets;
  await storeQuantitiesSold(locationId, tickets);
  while (omniResponse._links && omniResponse._links.next) {
    console.log("processing NEXT:", omniResponse._links.next.href);
    omniResponse = await axios.get(omniResponse._links.next.href, {
      headers: {
        "API-Key": OMNIVORE_API_KEY,
      },
    });
    omniResponse = omniResponse.data;
    await storeQuantitiesSold(locationId, omniResponse._embedded.tickets);
  }

  const response = { success: true };
  return response;
});

app.get("/locations/:locationId/items/popular", async (req, res) => {
  const request = {
    locationId: (req.params as any).locationId,
    startDate: (req.query as any).startDate,
    endDate: (req.query as any).endDate,
  };

  if (!request.endDate) {
    request.endDate = format(new Date(), "yyyy-LL-dd");
  }

  console.log("REQUEST", request);

  const subQuery = db
    .select("item_id", "item_name", db.raw("SUM(quantity_sold) as qty"))
    .from("omni.item_sales")
    .where("location_id", request.locationId)
    .andWhere("date", ">=", request.startDate)
    .andWhere("date", "<=", request.endDate)
    .groupBy("item_id", "item_name")
    .as("sales");
  const mostPopularItem = await db
    .select("*")
    .from(subQuery)
    .orderBy("sales.qty", "desc")
    .limit(1)
    .first();
  console.log("mostPopularItem:", mostPopularItem);
  return mostPopularItem;
});

start();

let storeQuantitiesSold = async (locationId: string, tickets: any[]) => {
  if (Array.isArray(tickets)) {
    for (let ticket of tickets) {
      const items = ticket._embedded.items;
      const closeDate = format(fromUnixTime(ticket.closed_at), "yyyy-LL-dd");
      const currentItemsSoldForDate = await db("omni.item_sales")
        .select(db.raw("date::date"), "location_id", "item_id", "item_name")
        .where("location_id", locationId)
        .andWhere("date", closeDate);

      for (let item of items) {
        const name = item.name;
        const quantity = item.quantity;
        const itemId = item._embedded.menu_item.id;

        const itemHasSoldToday = currentItemsSoldForDate.some(
          (c) =>
            format(c.date, "yyyy-LL-dd") === closeDate && c.item_id === itemId
        );
        if (itemHasSoldToday) {
          // perform update
          await db("omni.item_sales")
            .update({
              quantity_sold: db.raw(`quantity_sold + ${quantity}`),
            })
            .where("location_id", locationId)
            .andWhere("item_id", itemId);
        } else {
          // perform insert
          await db("omni.item_sales").insert({
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
};

let omniRequest = async (
  method: Method,
  path: string,
  fields: string[] = [],
  where: string = "",
  limit: number = 50
) => {
  let url = `${OMNIVORE_API_URL}/${path}?`;
  url += `limit=${limit}`;
  url += `&fields=${fields.join(",")}`;
  url += `&where=${where}`;

  console.log(`[OMNIVORE] ${method} ${url}`);

  const response = await axios(url, {
    method,
    headers: {
      "API-Key": OMNIVORE_API_KEY,
    },
  });

  return response.data;
};
