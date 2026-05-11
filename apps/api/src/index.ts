import { createApp } from "./server.js";

const port = Number(process.env.PORT || 4000);
const { httpServer } = createApp();

httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}`);
});