import { getStore } from "@netlify/blobs";
import { buildData, errorResponse, json } from "../lib/groupme.mjs";

export default async () => {
  try {
    return json(await buildData(getStore("groupme")));
  } catch (e) {
    return errorResponse(e);
  }
};

export const config = { path: "/api/data" };
