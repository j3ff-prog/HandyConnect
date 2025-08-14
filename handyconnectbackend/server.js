const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your_secret_key'; // change this in production
const saltRounds = 10;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Authenticate Token Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  if (!token) return res.status(401).json({ error: 'Token missing' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Connect to SQLite database
const db = new sqlite3.Database('./fundis.db', (err) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

// Create tables if they don't exist
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('client', 'fundi')),
    name TEXT,
    phone TEXT,
    email TEXT
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    service TEXT NOT NULL,
    description TEXT,
    price TEXT
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER,
    requester_name TEXT,
    requester_phone TEXT,
    status TEXT DEFAULT 'Pending',
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(service_id) REFERENCES services(id)
  )
`);

// Registration route (clients and fundis)
app.post('/api/register', async (req, res) => {
  const { username, password, role, name, phone, email } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, and role are required.' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const sql = "INSERT INTO users (username, password, role, name, phone, email) VALUES (?, ?, ?, ?, ?, ?)";
    db.run(sql, [username, hashedPassword, role, name, phone, email], function(err) {
      if (err) return res.status(500).json({ error: 'Username already exists or DB error' });
      res.json({ message: 'User registered successfully', userId: this.lastID });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const sql = 'SELECT * FROM users WHERE username = ?';
  db.get(sql, [username], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Login successful', token });
  });
});

// Authenticated route to add a new service (only fundis allowed)
app.post('/api/services', authenticateToken, (req, res) => {
  if (req.user.role !== 'fundi') {
    return res.status(403).json({ error: 'Only fundis can post services' });
  }
  const { name, service, description, price } = req.body;
  if (!name || !service) return res.status(400).json({ error: 'Name and service are required' });

  const sql = "INSERT INTO services (name, service, description, price) VALUES (?, ?, ?, ?)";
  db.run(sql, [name, service, description, price], function (err) {
    if (err) return res.status(500).json({ error: 'Failed to add service' });
    res.json({ id: this.lastID, name, service, description, price });
  });
});

// Public: Get all services
app.get('/api/services', (req, res) => {
  const sql = "SELECT * FROM services ORDER BY id DESC";
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch services' });
    res.json(rows);
  });
});

// Post request for a service (public)
app.post('/api/requests', (req, res) => {
  const { service_id, requester_name, requester_phone } = req.body;
  if (!service_id || !requester_name || !requester_phone) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const sql = "INSERT INTO requests (service_id, requester_name, requester_phone) VALUES (?, ?, ?)";
  db.run(sql, [service_id, requester_name, requester_phone], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to create request' });
    res.json({ id: this.lastID, service_id, requester_name, requester_phone, status: 'Pending' });
  });
});

// Get all requests (joined with service info)
app.get('/api/requests', (req, res) => {
  const sql = `
    SELECT requests.id, services.name AS fundi_name, services.service, requests.requester_name, requests.requester_phone, requests.status, requests.requested_at
    FROM requests
    JOIN services ON requests.service_id = services.id
    ORDER BY requests.requested_at DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch requests' });
    res.json(rows);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});