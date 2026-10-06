import { getStore } from "@netlify/blobs";
import { buildData, checkPassword, errorResponse, json } from "../lib/groupme.mjs";

export default async (req) => {
  try {
    checkPassword(req);
    return json(await buildData(getStore("groupme")));
  } catch (e) {
    return errorResponse(e);
  }
};

export const config = { path: "/api/data" };
