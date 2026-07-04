import { defineMcp } from "@lovable.dev/mcp-js";
import getActiveTheme from "./tools/get-active-theme";
import getPricing from "./tools/get-pricing";

export default defineMcp({
  name: "basma-hekaya-mcp",
  title: "بصمة حكاية MCP",
  version: "0.1.0",
  instructions:
    "Public read-only tools for بصمة حكاية (Basmat Hekaya): fetch the active seasonal theme and current story pricing.",
  tools: [getActiveTheme, getPricing],
});
