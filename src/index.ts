import app from "./app";
import { config } from "./config";
import { startListener } from "./services/listener.service";

app.listen(config.port, () => {
  console.log(
    `NexTrade API running on port ${config.port} [${config.nodeEnv}]`
  );
  console.log(`Chain: Base Sepolia (${config.chainId})`);

  startListener().catch((err) =>
    console.error("Failed to start deposit listener:", err)
  );
});
