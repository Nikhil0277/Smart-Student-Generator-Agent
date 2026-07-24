/**
 * Netlify Serverless Function — IBM WatsonX Proxy
 * Runs server-side, so there are no CORS issues.
 * Endpoint: /.netlify/functions/proxy
 */

const IAM_URL = "https://iam.cloud.ibm.com/identity/token";
const API_URL = "https://eu-de.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29";
const API_KEY = process.env.IBM_API_KEY;

exports.handler = async function (event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const action = body.action;

  // ── GET IAM TOKEN ──────────────────────────────────────────────────────────
  if (action === "token") {
    try {
      const res = await fetch(IAM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${API_KEY}`,
      });
      const data = await res.json();
      if (!res.ok) {
        return { statusCode: res.status, headers, body: JSON.stringify({ error: data }) };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          access_token: data.access_token,
          expires_in: data.expires_in,
        }),
      };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // ── CALL GRANITE ───────────────────────────────────────────────────────────
  if (action === "generate") {
    const { token, payload } = body;
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        return { statusCode: res.status, headers, body: JSON.stringify({ error: data }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: "Unknown action" }) };
};
