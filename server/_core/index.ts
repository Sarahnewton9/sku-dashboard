import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import multer from "multer";
import { parsePptxBuffer } from "../pptx_parser";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Image proxy — fetches CDN images server-side to avoid CORS issues in Excel exports
  app.get("/api/image-proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url || !url.startsWith("https://")) {
      res.status(400).send("Invalid URL");
      return;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) {
        res.status(response.status).send("Upstream error");
        return;
      }
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const buffer = Buffer.from(await response.arrayBuffer());
      res.set("Content-Type", contentType);
      res.set("Cache-Control", "public, max-age=86400");
      res.send(buffer);
    } catch (e) {
      res.status(500).send("Proxy error");
    }
  });

  // PPTX upload endpoint — accepts multipart/form-data to handle large files (>10MB)
  // Uses the Node.js parser (pptx_parser.ts) — no Python dependency required
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
  app.post("/api/pptx-upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }
    try {
      const parsed = await parsePptxBuffer(req.file.buffer);
      res.json({ success: true, parsed });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Parse failed" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
