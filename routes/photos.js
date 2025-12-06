const express = require('express')
const fs = require('fs')
const pool = require('../utils/db')
const result = require('../utils/result')
const config = require('../utils/config')
const multer = require('multer')

const upload = multer({ dest: 'photos/' })

const router = express.Router()

router.post("/addPhotos", upload.fields([{ name: "img1" }, { name: "img2" }, { name: "img3" }, { name: "img4" }, { name: "img5" }, { name: "img6" }]), (req, res) => {
    const uid = req.headers.uid

    const img1Name = req.files.img1[0].filename + ".jpg"
    const oldPathImg1 = req.files.img1[0].path;
    const newPathImg1 = oldPathImg1 + ".jpg"
    fs.renameSync(oldPathImg1, newPathImg1)

    const img2Name = req.files.img2[0].filename + ".jpg"
    const oldPathImg2 = req.files.img2[0].path;
    const newPathImg2 = oldPathImg2 + ".jpg"
    fs.renameSync(oldPathImg2, newPathImg2)

    const img3Name = req.files.img3[0].filename + ".jpg"
    const oldPathImg3 = req.files.img3[0].path;
    const newPathImg3 = oldPathImg3 + ".jpg"
    fs.renameSync(oldPathImg3, newPathImg3)

    const img4Name = req.files.img4[0].filename + ".jpg"
    const oldPathImg4 = req.files.img4[0].path;
    const newPathImg4 = oldPathImg4 + ".jpg"
    fs.renameSync(oldPathImg4, newPathImg4)

    const img5Name = req.files.img5[0].filename + ".jpg"
    const oldPathImg5 = req.files.img5[0].path;
    const newPathImg5 = oldPathImg5 + ".jpg"
    fs.renameSync(oldPathImg5, newPathImg5)

    const img6Name = req.files.img6[0].filename + ".jpg"
    const oldPathImg6 = req.files.img6[0].path;
    const newPathImg6 = oldPathImg6 + ".jpg"
    fs.renameSync(oldPathImg6, newPathImg6)

    const sql = `INSERT INTO userphotos(uid,photo_url) VALUES(?,?),(?,?),(?,?),(?,?),(?,?),(?,?)`
    pool.query(sql, [uid, img1Name, uid, img2Name, uid, img3Name, uid, img4Name, uid, img5Name, uid, img6Name], (err, data) => {
        console.log("Before Sending " + data)
        res.send(result.createResult(err, data))

    })
})

router.get('/userphotos', (req, res) => {
    const uid = req.headers.uid
    console.log(uid)
    const sql = `select * from userphotos where uid = ?`    
    pool.query(sql,[uid], (err, data) => {
        console.log(err)
        res.send(result.createResult(err, data))
    })
})

module.exports = router