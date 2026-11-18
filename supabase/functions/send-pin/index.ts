import { admin, cors, EMAIL, json, sha256 } from "../_shared/common.ts";

const TEN_MIN = 10 * 60_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (email.length > 254 || !EMAIL.test(email)) return json(req, { error: "Enter a valid email address." }, 400);

    // limits: 3 codes per address per 10 min, 30 codes overall per minute
    const count = async (since: number, eq?: string) => {
      let q = admin.from("email_pins").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - since).toISOString());
      if (eq) q = q.eq("email", eq);
      return (await q).count ?? 0;
    };
    if ((await count(TEN_MIN, email)) >= 3) return json(req, { error: "Too many codes requested. Wait 10 minutes." }, 429);
    if ((await count(60_000)) >= 30) return json(req, { error: "Busy. Try again in a minute." }, 429);

    const pin = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    const { error } = await admin.from("email_pins").insert({
      email,
      pin_hash: await sha256(`${pin}:${email}:${Deno.env.get("PIN_PEPPER")}`),
      expires_at: new Date(Date.now() + TEN_MIN).toISOString(),
    });
    if (error) throw error;
    await admin.from("email_pins").delete().lt("expires_at", new Date(Date.now() - 86_400_000).toISOString());

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": Deno.env.get("BREVO_API_KEY")!, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: Deno.env.get("SENDER_NAME") ?? "Mind to Machine", email: Deno.env.get("SENDER_EMAIL") },
        to: [{ email }],
        subject: "Your Mind to Machine sign-in code",
        htmlContent: `<p>Your sign-in code is</p><p style="font-size:28px;letter-spacing:6px"><b>${pin}</b></p><p>It expires in 10 minutes. If you did not ask for it, ignore this email.</p>`,
      }),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}`);
    return json(req, { ok: true });
  } catch (e) {
    console.error(e);
    return json(req, { error: "Could not send the code. Try again." }, 500);
  }
});
