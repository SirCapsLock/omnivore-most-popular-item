import { fastify } from "fastify";
import Knex from "knex";
import { LocationController } from "./controllers/location.controller";

const PORT: number = parseInt(process.env.PORT as string) || 9000;
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

const locationController = new LocationController(db);
app.post("/locations/:locationId/seed", async (req, res) => {
  return locationController.seed(req, res);
});

app.get("/locations/:locationId/items/popular", async (req, res) => {
  return locationController.getMostPopularItem(req, res);
});

start();
