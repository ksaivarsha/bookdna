/** Shelf view for the recommend tool. */
import { useToolContext } from "mcp-use/react";
import { Shelf } from "./Shelf.js";

export default function BookShelfView() {
  return <Shelf {...useToolContext<"recommend">()} />;
}
