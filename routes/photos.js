const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const pool = require("../utils/db");
const result = require("../utils/result");

const router = express.Router();

/* ----------------------  MULTER TEMP STORAGE  ---------------------- */
const storage = multer.memoryStorage(); // files stay in memory
const upload = multer({ storage });

/* ----------------------  UPLOAD 6 IMAGES + WEBP --------------------- */

router.post("/upload", upload.array("photos", 6), async (req, res) => {
  try {
    const uid = req.headers.uid;

    if (!uid) return res.send(result.createResult("Missing uid"));

    const files = req.files;
    if (!files || files.length !== 6) {
      return res.send(result.createResult("Exactly 6 photos required"));
    }

    // Directory
    const folder = "profilePhotos";
    if (!fs.existsSync(folder)) fs.mkdirSync(folder);

    const finalPhotos = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Generate filename
      const filename = `${uid}-${Date.now()}-${i}.webp`;
      const filepath = path.join(folder, filename);

      // Convert → WEBP
      await sharp(file.buffer)
        .resize(900, 1200, { fit: "cover" })
        .webp({ quality: 85 })
        .toFile(filepath);

      // Save relative path
      finalPhotos.push(`/profilePhotos/${filename}`);
    }

    // is_primary mapping
    const values = [
      [uid, finalPhotos[0], 1, 1], // DP
      [uid, finalPhotos[1], 2, 1], // Profile card
      [uid, finalPhotos[2], 0, 1],
      [uid, finalPhotos[3], 0, 1],
      [uid, finalPhotos[4], 0, 1],
      [uid, finalPhotos[5], 0, 1],
    ];

    const sql = `
      INSERT INTO userphotos (uid, photo_url, is_primary, is_approved)
      VALUES ?
    `;

    pool.query(sql, [values], (err) => {
      res.send(result.createResult(err, { uploaded: true }));
    });

  } catch (err) {
    console.error(err);
    res.send(result.createResult("Server error"));
  }
});

/* ----------------------  GET USER PHOTOS ---------------------------- */

router.get("/userphotos", (req, res) => {
  const uid = req.headers.uid;

  const sql = `
    SELECT photo_id, photo_url, prompt, is_primary
    FROM userphotos
    WHERE uid = ?
    AND is_approved = 1
    ORDER BY 
      CASE 
        WHEN is_primary = 1 THEN 0 
        WHEN is_primary = 2 THEN 1
        ELSE 2
      END,
      uploaded_at ASC;
  `;

  pool.query(sql, [uid], (err, data) => {
    res.send(result.createResult(err, data));
  });
});

module.exports = router;
