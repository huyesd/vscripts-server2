
const express = require("express");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(express.json());

// ---------------- CONFIG ----------------
const PAYHIP_SECRET = "prod_sk_isMgx_74c58ed9c4a04aa2e0b2c38d996e8cc338374c5b";
const PAYHIP_URL = "https://payhip.com/api/v2/license/verify";

// ---------------- DATABASE ----------------
const db = new sqlite3.Database("./licenses.db");
db.run(`
  CREATE TABLE IF NOT EXISTS licenses (
    license TEXT,
    robloxUserId TEXT,
    productId TEXT,
    PRIMARY KEY (license, productId)
  )
`);

// ---------------- VERIFY ENDPOINT ----------------
app.post("/verify", async (req, res) => {
  const { licenseKey, robloxUserId, productId } = req.body;

  if (!licenseKey || !robloxUserId || !productId) {
    return res.json({ success: false, error: "Missing data" });
  }

  console.log("Attempt:", licenseKey, robloxUserId, productId);

  try {
    // 1️⃣ Verify license with Payhip
    const r = await axios.get(PAYHIP_URL, {
      params: { license_key: licenseKey },
      headers: { "product-secret-key": PAYHIP_SECRET }
    });

    const data = r.data;
    if (!data.data || !data.data.enabled) {
      return res.json({ success: false, error: "License invalid or disabled" });
    }

    // 2️⃣ Check database for binding
    db.get(
      "SELECT robloxUserId FROM licenses WHERE license = ? AND productId = ?",
      [licenseKey, productId],
      (err, row) => {
        if (err) return res.json({ success: false, error: "DB error" });

        if (row && row.robloxUserId !== robloxUserId) {
          return res.json({ success: false, error: "License already bound to another user" });
        }

        // 3️⃣ If not bound yet, insert into DB
        if (!row) {
          db.run(
            "INSERT INTO licenses (license, robloxUserId, productId) VALUES (?, ?, ?)",
            [licenseKey, robloxUserId, productId]
          );
        }

        return res.json({ success: true, buyer: data.data.buyer_email });
      }
    );

  } catch (e) {
    console.error(e.message);
    return res.json({ success: false, error: "Server error" });
  }
});

// ---------------- START SERVER ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
