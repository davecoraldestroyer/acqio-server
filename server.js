const express = require("express");
const app = express();
const PORT = process.env.PORT || 8080;

// Manuell CORS Headers für jeden Request setzen
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({ status: "ACQIO Server läuft ✓" });
});

app.post("/analyze", async (req, res) => {
  const { fileName, fileContent } = req.body;

  if (!fileContent) {
    return res.status(400).json({ error: "Kein Dateiinhalt übermittelt" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API-Key nicht konfiguriert" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: `Du bist ein KI-Agent für Schweizer Immobilieninvestoren. 
Analysiere den folgenden E-Mail- oder Exposé-Inhalt und extrahiere strukturierte Immobiliendaten.

Antworte NUR mit einem JSON-Objekt (kein Markdown, keine Erklärungen, keine Backticks) mit diesen Feldern:
{
  "name": "Objektbezeichnung",
  "type": "Büro|Wohnen|Logistik|Einzelhandel|Hotel|Mischnutzung",
  "location": "Stadt, Kanton (z.B. Zürich, ZH)",
  "price": Kaufpreis als Zahl in CHF,
  "size": Fläche als Zahl in m²,
  "yield": Bruttorendite als Zahl in Prozent,
  "noi": Nettobetriebsertrag pro Jahr als Zahl in CHF,
  "occupancy": Vermietungsstand als Zahl in Prozent,
  "buildYear": Baujahr als vierstellige Zahl,
  "broker": "Name des Maklers",
  "brokerCompany": "Name der Maklerfirma",
  "brokerEmail": "E-Mail-Adresse oder leerer String",
  "tags": ["max. 3 Tags"],
  "score": Zahl 0-100,
  "summary": "2 Sätze Zusammenfassung auf Deutsch"
}
Falls Werte fehlen, schätze plausibel. Währung immer CHF.`,
        messages: [
          {
            role: "user",
            content: `Dateiname: ${fileName}\n\nInhalt:\n${fileContent.substring(0, 4000)}`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: "Anthropic API Fehler", details: data });
    }

    const text = data.content?.find((b) => b.type === "text")?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    res.json({ success: true, property: parsed });
  } catch (err) {
    console.error("Fehler:", err);
    res.status(500).json({ error: "Analyse fehlgeschlagen", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`ACQIO Server läuft auf Port ${PORT}`);
});
