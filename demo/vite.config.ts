import { defineConfig, type PluginOption } from "vite";
import { createApiHandler } from "rootcap/server";

const apiPlugin: PluginOption = {
  name: "rootcap-demo-api",
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
  plugins: [apiPlugin],
  server: { host: "0.0.0.0", port: 3001 },
});
