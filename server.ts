import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware de compressão para performance
  app.use(compression());

  // Middleware para JSON
  app.use(express.json());

  // Middleware de Log de Requisições para Monitoramento
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  // Exemplo de Rota de API do Backend (Saúde do Sistema)
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "online", 
      timestamp: new Date().toISOString(),
      version: "1.0.0-backend-force"
    });
  });

  // Configuração do Vite para desenvolvimento ou produção
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Servidor rodando em modo DESENVOLVIMENTO (Vite Middleware)");
  } else {
    // Servir arquivos estáticos em produção
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Servidor rodando em modo PRODUÇÃO");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend Almox Pro ativo em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Falha ao iniciar o servidor:", err);
  process.exit(1);
});
