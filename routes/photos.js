const express = require('express')
const fs = require('fs')
const pool = require('../utils/db')
const result = require('../utils/result')
const config = require('../utils/config')
const multer = require('multer')

const upload = multer({ dest: 'profilePhotos/' })

const router = express.Router()

router.post(
    "/addPhotos",
    upload.fields([
        { name: "img0" },
        { name: "img1" },
        { name: "img2" },
        { name: "img3" },
        { name: "img4" },
        { name: "img5" }
    ]),
    (req, res) => {
        const uid = req.headers.uid;

        // Utility to rename file to .jpg
        const renameFile = (file) => {
            const newName = file.filename + ".jpg";
            fs.renameSync(file.path, file.path + ".jpg");
            return newName;
        };

        const img0Name = renameFile(req.files.img0[0]); // primary 1
        const img1Name = renameFile(req.files.img1[0]); // primary 2
        const img2Name = renameFile(req.files.img2[0]);
        const img3Name = renameFile(req.files.img3[0]);
        const img4Name = renameFile(req.files.img4[0]);
        const img5Name = renameFile(req.files.img5[0]);

        const sql = `
      INSERT INTO userphotos(uid, photo_url, is_primary) 
      VALUES
        (?, ?, 1),  -- img0 primary
        (?, ?, 2),  -- img1 secondary
        (?, ?, 0),  -- img2
        (?, ?, 0),  -- img3
        (?, ?, 0),  -- img4
        (?, ?, 0)   -- img5
    `;

        pool.query(
            sql,
            [
                uid, img0Name,
                uid, img1Name,
                uid, img2Name,
                uid, img3Name,
                uid, img4Name,
                uid, img5Name
            ],
            (err, data) => {
                res.send(result.createResult(err, data));
            }
        );
    }
);


router.get('/userphotos', (req, res) => {
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


module.exports = router