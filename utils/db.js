// db.js
require('dotenv').config(); // Ensure dotenv is configured if running locally

const mysql = require('mysql2/promise'); 

// Change: Use a single env variable for the cert content, not a file path
const db_host = process.env.DB_HOST;
const db_ssl_ca_cert = process.env.DB_SSL_CA_CERT_CONTENT; // New ENV variable name

// Validate necessary environment variables are set
if (!db_host || !db_ssl_ca_cert) {
    console.error("Missing critical environment variables: DB_HOST or DB_SSL_CA_CERT_CONTENT");
    process.exit(1); 
}

const pool = mysql.createPool({
    host: db_host, 
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME,
    connectionLimit: 10,
    ssl: {
        // Change: Pass the environment variable string directly
        ca: db_ssl_ca_cert, 
        rejectUnauthorized: true 
    }
});

module.exports = pool;
