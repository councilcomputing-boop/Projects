const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const Anthropic = require("@anthropic-ai/sdk");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const DAILY_AI_LIMIT = 10;

async function enforceDailyLimit(uid) {
  const today = new Date().toISOString().slice(0, 10);
  const usageRef = db.collection("aiUsage").doc(`${uid}_${today}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const count = snap.exists ? snap.data().count : 0;
    if (count >= DAILY_AI_LIMIT) {
      throw new HttpsError("resource-exhausted", `Daily AI limit reached (${DAILY_AI_LIMIT}/day). Try again tomorrow.`);
    }
    tx.set(usageRef, {count: count + 1, uid, date: today}, {merge: true});
  });
}

exports.draftOutreachEmail = onCall({secrets: [anthropicApiKey]}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  await enforceDailyLimit(request.auth.uid);

  const {company, type, topic, tone, keyPoints, senderName, senderCompany} = request.data || {};
  if (!company || typeof company !== "string") {
    throw new HttpsError("invalid-argument", "Missing company name.");
  }
  if (!topic || typeof topic !== "string") {
    throw new HttpsError("invalid-argument", "Missing topic.");
  }

  const client = new Anthropic({apiKey: anthropicApiKey.value()});

  const prompt = `Write a short, direct cold-outreach email.

Recipient: ${company} (a ${type || "company"}).
Sender: ${senderName || "the sender"}${senderCompany ? `, ${senderCompany}` : ""}.
What this email is about: ${topic}
Tone: ${tone || "professional"}
${keyPoints ? `Specific points to work in: ${keyPoints}` : ""}

Rules:
- Under 150 words.
- No greeting boilerplate like "I hope this finds you well".
- One clear ask at the end.
- Plain text only — no subject line, no signature (the app adds that separately).`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    messages: [{role: "user", content: prompt}],
  });

  const text = message.content.find((b) => b.type === "text")?.text || "";
  return {message: text.trim()};
});

exports.reviseOutreachEmail = onCall({secrets: [anthropicApiKey]}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  await enforceDailyLimit(request.auth.uid);

  const {currentMessage, instructions} = request.data || {};
  if (!currentMessage || typeof currentMessage !== "string") {
    throw new HttpsError("invalid-argument", "Missing current message.");
  }
  if (!instructions || typeof instructions !== "string") {
    throw new HttpsError("invalid-argument", "Missing revision instructions.");
  }

  const client = new Anthropic({apiKey: anthropicApiKey.value()});

  const prompt = `Revise the following cold-outreach email per the instructions below. Keep it plain text — no subject line, no signature. Return only the revised email, nothing else.

Current email:
"""
${currentMessage}
"""

Instructions: ${instructions}`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    messages: [{role: "user", content: prompt}],
  });

  const text = message.content.find((b) => b.type === "text")?.text || "";
  return {message: text.trim()};
});
