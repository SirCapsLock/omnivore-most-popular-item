import { fastify, FastifyRequest } from "fastify";

const PORT: number = 9000;
const app = fastify({
  ignoreTrailingSlash: true,
});

const start = async () => {
  console.log(`Omni App Listening on port ${PORT}`);
  await app.listen(PORT, "0.0.0.0");
};

app.post("/seed", async (req, res) => {
  const response = { success: true };
  return response;
});

start();
