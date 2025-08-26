const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// Serve homepage.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'homepage.html'));
});

// Serve static files from the FIXMATE directory
app.use(express.static(path.join(__dirname)));

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  // Replace this with your actual user lookup logic
  const user = await findUserByUsernameAndPassword(username, password); // <-- implement this
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // Replace this with your actual token generation logic
  const token = generateToken(user); // <-- implement this
  // Send token and role
  res.json({ token, role: user.role });
});

// Use this inside your payment.html <script> block

app.listen(PORT, () => {
  console.log(`Frontend server running at http://localhost:3000`);
});