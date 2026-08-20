const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const Anthropic = require("@anthropic-ai/sdk");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const DAILY_DRAFT_LIMIT = 10;

exports.draftOutreachEmail = onCall({secrets: [anthropicApiKey]}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const usageRef = db.collection("aiUsage").doc(`${request.auth.uid}_${today}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const count = snap.exists ? snap.data().count : 0;
    if (count >= DAILY_DRAFT_LIMIT) {
      throw new HttpsError("resource-exhausted", `Daily AI draft limit reached (${DAILY_DRAFT_LIMIT}/day). Try again tomorrow.`);
    }
    tx.set(usageRef, {count: count + 1, uid: request.auth.uid, date: today}, {merge: true});
  });

  const {company, type, senderName, senderCompany} = request.data || {};
  if (!company || typeof company !== "string") {
    throw new HttpsError("invalid-argument", "Missing company name.");
  }

  const client = new Anthropic({apiKey: anthropicApiKey.value()});

  const prompt = `Write a short, direct cold-outreach email.

Recipient: ${company} (a ${type || "company"}).
Sender: ${senderName || "the sender"}${senderCompany ? `, ${senderCompany}` : ""}.

Rules:
- Under 120 words.
- No greeting boilerplate like "I hope this finds you well".
- One clear ask at the end.
- Plain text only — no subject line, no signature (the app adds that separately).`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 300,
    messages: [{role: "user", content: prompt}],
  });

  const text = message.content.find((b) => b.type === "text")?.text || "";
  return {message: text.trim()};
});
