const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors()); // Erlaubt Anfragen vom Browser
app.use(express.json({ limit: "10mb" })); // Grosse Dokumente erlauben

// Health-Check — zum Testen ob der Server läuft
app.get("/", (req, res) => {
  res.json({ status: "ACQIO Server läuft ✓" });
});

// Haupt-Endpunkt: empfängt Dokument, schickt es an Anthropic
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
  "name": "Objektbezeichnung (z.B. Bürogebäude Bahnhofstrasse 12)",
  "type": "Büro|Wohnen|Logistik|Einzelhandel|Hotel|Mischnutzung",
  "location": "Stadt, Kanton (z.B. Zürich, ZH)",
  "price": Kaufpreis als Zahl in CHF,
  "size": Fläche als Zahl in m²,
  "yield": Bruttorendite als Zahl in Prozent (z.B. 4.5),
  "noi": Nettobetriebsertrag pro Jahr als Zahl in CHF,
  "occupancy": Vermietungsstand als Zahl in Prozent,
  "buildYear": Baujahr als vierstellige Zahl,
  "broker": "Name des Maklers oder der Kontaktperson",
  "brokerCompany": "Name der Maklerfirma oder des Anbieters",
  "brokerEmail": "E-Mail-Adresse falls vorhanden, sonst leerer String",
  "tags": ["max. 3 relevante Tags, z.B. Core, Value-Add, Sanierungspotenzial"],
  "score": Investmentqualität von 0 bis 100 basierend auf Rendite, Lage, Zustand,
  "summary": "Kurze Zusammenfassung des Objekts in 2 Sätzen auf Deutsch"
}

Wichtige Regeln:
- Währung ist immer CHF (Schweizer Franken)
- Standorte sind Schweizer Städte und Kantone
- Falls ein Wert nicht im Text steht, schätze ihn plausibel basierend auf Kontext
- Falls kein Immobilieninhalt erkennbar ist, antworte mit {"error": "Kein Immobilieninhalt erkannt"}`,
        messages: [
          {
            role: "user",
            content: `Dateiname: ${fileName}\n\nDokumentinhalt:\n${fileContent.substring(0, 4000)}`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: "Anthropic API Fehler", details: data });
    }

    const text = data.content?.find((b) => b.type === "text")?.text || "{}";
    const parsed = JSON.parse(text.trim());

    res.json({ success: true, property: parsed });
  } catch (err) {
    console.error("Fehler:", err);
    res.status(500).json({ error: "Analyse fehlgeschlagen", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`ACQIO Server läuft auf Port ${PORT}`);
});
