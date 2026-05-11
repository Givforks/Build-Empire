import { createApp } from "./server.js";
import { config } from "./config.js";

const port = config.PORT;
const { httpServer } = createApp();

httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port}`);
});