// db.js
require('dotenv').config();

const mysql = require('mysql2');

if (!process.env.DB_HOST || !process.env.DB_SSL_CA_CERT_CONTENT) {
    console.error("❌ Missing DB_HOST or DB_SSL_CA_CERT_CONTENT");
    process.exit(1);
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,   // should be "defaultdb"
    port: process.env.DB_PORT,       // MUST add this (10082)
    connectionLimit: 10,
    ssl: {
        ca: process.env.DB_SSL_CA_CERT_CONTENT,
        rejectUnauthorized: true,
        minVersion: "TLSv1.2"         // REQUIRED by Aiven
    }
});

module.exports = pool;