import { admin, cors, EMAIL, json, safeEqual, sha256 } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const pin = String(body?.pin ?? "");
    const bad = () => json(req, { error: "That code is wrong or expired." }, 400);
    if (email.length > 254 || !EMAIL.test(email) || !/^\d{6}$/.test(pin)) return bad();

    const { data: row } = await admin.from("email_pins").select("*").eq("email", email).eq("used", false)
      .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row) return bad();
    if (row.attempts >= 5) {
      await admin.from("email_pins").update({ used: true }).eq("id", row.id);
      return json(req, { error: "Too many tries. Request a new code." }, 429);
    }
    const ok = safeEqual(await sha256(`${pin}:${email}:${Deno.env.get("PIN_PEPPER")}`), row.pin_hash);
    if (!ok) {
      await admin.from("email_pins").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return bad();
    }
    await admin.from("email_pins").update({ used: true }).eq("id", row.id);

    await admin.auth.admin.createUser({ email, email_confirm: true }); // error if the user exists: fine
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !data?.properties?.hashed_token) throw error ?? new Error("No token");
    return json(req, { token_hash: data.properties.hashed_token }); // browser exchanges it with verifyOtp
  } catch (e) {
    console.error(e);
    return json(req, { error: "Could not verify the code." }, 500);
  }
});
