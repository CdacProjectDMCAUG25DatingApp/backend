const express = require("express");
const fs = require("fs");
const path = require("path");
const pool = require("../utils/db");
const result = require("../utils/result");
const multer = require("multer");

const router = express.Router();

/* ----------------------  MULTER STORAGE  ---------------------- */
/* Always store with extension! */

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "profilePhotos/");
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || ".jpg";
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
        cb(null, unique);
    },
});

const upload = multer({ storage });

/* ---------------------  UPLOAD ROUTE  -------------------------- */

router.post(
    "/addPhotos",
    upload.fields([
        { name: "img0", maxCount: 1 },
        { name: "img1", maxCount: 1 },
        { name: "img2", maxCount: 1 },
        { name: "img3", maxCount: 1 },
        { name: "img4", maxCount: 1 },
        { name: "img5", maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            const uid = req.headers.uid;

            if (!uid) {
                return res.send(result.createResult("Missing UID"));
            }

            if (!req.files || Object.keys(req.files).length < 6) {
                return res.send(result.createResult("All 6 images are required"));
            }

            const getFile = (name) => req.files[name]?.[0]?.filename || null;

            const img0 = getFile("img0");
            const img1 = getFile("img1");
            const img2 = getFile("img2");
            const img3 = getFile("img3");
            const img4 = getFile("img4");
            const img5 = getFile("img5");

            if (!img0 || !img1 || !img2 || !img3 || !img4 || !img5) {
                return res.send(result.createResult("Missing one or more required images"));
            }

            const sql = `
                INSERT INTO userphotos (uid, photo_url, is_primary)
                VALUES
                    (?, ?, 1),
                    (?, ?, 2),
                    (?, ?, 0),
                    (?, ?, 0),
                    (?, ?, 0),
                    (?, ?, 0)
            `;

            pool.query(
                sql,
                [
                    uid, img0,
                    uid, img1,
                    uid, img2,
                    uid, img3,
                    uid, img4,
                    uid, img5
                ],
                (err, data) => {
                    res.send(result.createResult(err, data));
                }
            );
        } catch (err) {
            console.error("Upload error:", err);
            return res.send(result.createResult("Server Error"));
        }
    }
);

/* ---------------------  GET USER PHOTOS  ------------------------ */

router.get("/userphotos", (req, res) => {
    const uid = req.headers.uid;

    const sql = `
        SELECT photo_id, photo_url, prompt, is_primary
        FROM userphotos
        WHERE uid = ? AND is_approved = 1
        ORDER BY 
            CASE 
                WHEN is_primary = 1 THEN 0
                WHEN is_primary = 2 THEN 1
                ELSE 2
            END,
            uploaded_at ASC
    `;

    pool.query(sql, [uid], (err, data) => {
        res.send(result.createResult(err, data));
    });
});

module.exports = router;
