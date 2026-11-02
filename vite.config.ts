import { defineConfig, type PluginOption } from "vite";
import { createApiHandler } from "./lib/api/server.js";

const devApiPlugin: PluginOption = {
  name: "rootcap-dev-api",
  configureServer(server) {
    const api = createApiHandler({ demoSubmit: true });
    server.middlewares.use((req, res, next) => {
      void api(req, res)
        .then((handled) => {
          if (!handled) next();
        })
        .catch(next);
    });
  },
};
export default defineConfig({
  plugins: [devApiPlugin],
  server: { host: "0.0.0.0", port: 3000 },
  build: { target: "es2022" },
});
