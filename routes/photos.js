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
      finalPhotos.push(`${filename}`);
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

router.put("/replace", upload.single("photo"), async (req, res) => {
  try {
    const { photo_id } = req.body;
    const file = req.file;

    if (!photo_id || !file) {
      return res.send(result.createResult("photo_id and new file required"));
    }

    // 1) Get old photo details
    const [[oldPhoto]] = await pool.promise().query(
      "SELECT photo_url FROM userphotos WHERE photo_id = ?",
      [photo_id]
    );

    if (!oldPhoto) {
      return res.send(result.createResult("Photo not found"));
    }

    const oldPath = path.join("profilePhotos", oldPhoto.photo_url);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

    // 2) Generate new filename
    const newFileName = `${photo_id}-${Date.now()}.webp`;
    const newFilePath = path.join("profilePhotos", newFileName);

    // 3) Save new file using sharp
    await sharp(file.buffer)
      .resize(900, 1200, { fit: "cover" })
      .webp({ quality: 85 })
      .toFile(newFilePath);

    // 4) Update DB
    await pool.promise().query(
      "UPDATE userphotos SET photo_url = ? WHERE photo_id = ?",
      [newFileName, photo_id]
    );

    res.send(
      result.createResult(null, {
        updated: true,
        photo_id,
        new_url: newFileName,
      })
    );
  } catch (err) {
    console.log(err);
    res.send(result.createResult(err));
  }
});


/* ============================================================
    PATCH: Update Photo Prompt
============================================================ */
router.patch("/prompt", (req, res) => {
    const uid = req.headers.uid;
    const { photo_id, prompt } = req.body;

    if (!uid || !photo_id)
        return res.send(result.createResult("Missing uid or photo_id"));

    const sql = `
        UPDATE userphotos
        SET prompt = ?
        WHERE photo_id = ? AND uid = ? AND is_deleted = 0
    `;

    pool.query(sql, [prompt, photo_id, uid], (err, data) => {
        return res.send(result.createResult(err, data));
    });
});


module.exports = router;
