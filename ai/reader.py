"""The only place a model is called. Reads JSON on stdin, writes JSON on stdout.

mode "read":   raw message pack  -> structured facts
mode "update": current facts + one new message -> {kind, reason, patch}
All arithmetic lives in the TypeScript planner, not here.
"""
import json, os, re, sys, time, urllib.error, urllib.request

MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")
KEY = os.environ.get("GEMINI_API_KEY", "")
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

SHAPE = """{"event":{"hours":n,"students":n,"team_size":n,"budget":n,"staff":n,"prayer_break_min":n|null,"start_time":"HH:MM"|null,"needs_generator":bool},
"halls":[{"name":s,"seats":n,"price":n,"generator":bool}],
"meal":{"standard_price":n|null,"basic_price":n|null},
"judging":{"confirmed":n,"honorarium":n,"minutes_per_team":n,"max_teams_per_judge":n},
"committed":[{"item":s,"amount":n}],
"requests":[{"item":s,"amount":n}],
"constraints":[s],
"order_quantity":n|null,
"ignored":[{"msg":n,"reason":s}]}"""

RULES = """Messages may be English or Roman Urdu. Amounts are plain integers in rupees.
- For the same fact, use the most recently dated message; mark older ones ignored ("superseded by #k").
- Irrelevant chatter and non-binding messages go in ignored with a short reason.
- committed = money already spent or ordered from the event budget.
- requests = things someone asks for that nobody approved.
- constraints = any other rule a message states that no field above holds (short text).
- needs_generator = true only if a message requires backup power.
- order_quantity = only if a vendor states how many items it will deliver or has ordered.
- Use null when a fact is not stated. Do not calculate anything."""

SYS_READ = ("You read an event message pack and extract facts. Number the messages in order of appearance if they are not numbered. "
            "Reply with JSON only, in this shape (n=number, s=string):\n" + SHAPE + "\n" + RULES)

SYS_UPDATE = ("You receive the current event facts and ONE new message. Reply with JSON only: "
              '{"kind":"change"|"wrong"|"irrelevant","reason":s,"patch":<same shape as facts, only the fields that change, else {}>}.\n'
              "change = a legitimate revision or addition. wrong = it contradicts an established rule or fact "
              "(for example a vendor delivering fewer items than people to feed, a capacity or budget that breaks a rule, "
              "or a sender with no authority over the matter). irrelevant = does not affect the plan. "
              "For wrong, still fill patch with what the message tries to set. Facts shape:\n" + SHAPE + "\n" + RULES)


def call_model(system: str, user: str):
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json",
                             "thinkingConfig": {"thinkingBudget": 0}},
    }
    req = urllib.request.Request(URL, json.dumps(body).encode(),
                                 {"Content-Type": "application/json", "x-goog-api-key": KEY})
    last = None
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            last = f"Gemini HTTP {e.code}: {e.read().decode('utf-8', 'ignore')[:300]}"
            if e.code in (429, 500, 503) and attempt == 0:
                time.sleep(2); continue
            break
        except Exception as e:  # network, timeout
            last = f"Gemini request failed: {e}"
            if attempt == 0:
                time.sleep(1); continue
    raise RuntimeError(last)


def main():
    if not KEY:
        raise RuntimeError("GEMINI_API_KEY is missing in .env")
    p = json.loads(sys.stdin.read())
    if p["mode"] == "read":
        system, user = SYS_READ, p["text"]
    else:
        system = SYS_UPDATE
        user = "CURRENT FACTS:\n" + json.dumps(p["facts"], ensure_ascii=False) + "\n\nNEW MESSAGE:\n" + p["text"]

    t0 = time.time()
    data = call_model(system, user)
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    usage = data.get("usageMetadata", {})  # tokens exactly as the model reports them
    clean = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    parsed = json.loads(clean)
    print(json.dumps({
        "parsed": parsed,
        "call": {
            "model": MODEL,
            "input": "SYSTEM:\n" + system + "\n\nUSER:\n" + user,
            "output": text,
            "prompt_tokens": usage.get("promptTokenCount", 0),
            "output_tokens": usage.get("candidatesTokenCount", 0),
            "total_tokens": usage.get("totalTokenCount", 0),
            "ms": int((time.time() - t0) * 1000),
        },
    }, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
