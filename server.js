const express = require("express");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(express.json());

const PAYHIP_SECRET = "prod_sk_isMgx_74c58ed9c4a04aa2e0b2c38d996e8cc338374c5b";
const PAYHIP_URL = "https://payhip.com/api/v2/license/verify";

const db = new sqlite3.Database("./licenses.db");
db.run(`
  CREATE TABLE IF NOT EXISTS licenses (
    license TEXT PRIMARY KEY,
    robloxUserId TEXT
  )
`);

app.post("/verify", async (req, res) => {
  const { licenseKey, robloxUserId } = req.body;
  if (!licenseKey || !robloxUserId)
    return res.json({ success: false });

  try {
    const r = await axios.get(PAYHIP_URL, {
      params: { license_key: licenseKey },
      headers: { "product-secret-key": PAYHIP_SECRET }
    });

    if (!r.data.data || !r.data.data.enabled)
      return res.json({ success: false });

    db.get(
      "SELECT robloxUserId FROM licenses WHERE license = ?",
      [licenseKey],
      (err, row) => {
        if (row && row.robloxUserId !== robloxUserId)
          return res.json({ success: false });

        if (!row) {
          db.run(
            "INSERT INTO licenses VALUES (?, ?)",
            [licenseKey, robloxUserId]
          );
        }

        res.json({ success: true });
      }
    );
  } catch {
    res.json({ success: false });
  }
});

app.listen(3000, () => console.log("Server running"));