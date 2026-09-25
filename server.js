require("dotenv").config();

const express = require("express");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod");

function createServer() {
  const server = new McpServer({
    name: "Korean Law MCP",
    version: "1.0.0",
  });

  server.registerTool(
    "search_korean_law",
    {
      title: "대한민국 현행 법령 검색",
      description:
        "국가법령정보 공동활용 API를 이용하여 대한민국 현행 법령을 검색합니다.",
      inputSchema: {
        query: z.string().describe("검색할 법령명 또는 검색어"),
      },
    },
    async ({ query }) => {
      try {
        const oc = process.env.LAW_API_OC;

        if (!oc) {
          throw new Error("LAW_API_OC가 설정되지 않았습니다.");
        }

        const url = new URL("https://www.law.go.kr/DRF/lawSearch.do");

        url.searchParams.set("OC", oc);
        url.searchParams.set("target", "law");
        url.searchParams.set("type", "JSON");
        url.searchParams.set("query", query);
        url.searchParams.set("display", "20");

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(
            `국가법령정보 API 오류: ${response.status} ${response.statusText}`
          );
        }

        const text = await response.text();

        return {
          content: [
            {
              type: "text",
              text: text,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `법령 검색 중 오류가 발생했습니다: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Korean Law MCP Server is running.");
});

app.post("/mcp", async (req, res) => {
  try {
    const server = createServer();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error(error);

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("---------------------------------------");
  console.log("Korean Law MCP Server");
  console.log(`http://localhost:${PORT}/mcp`);
  console.log("---------------------------------------");
});
app.get("/mcp", (req, res) => {
  res.send("Korean Law MCP endpoint is ready.");
});