/** Shelf view for the recommend_by_tropes tool. */
import { useToolContext } from "mcp-use/react";
import { Shelf } from "../book-shelf/Shelf.js";

export default function TropeShelfView() {
  return <Shelf {...useToolContext<"recommend_by_tropes">()} />;
}
