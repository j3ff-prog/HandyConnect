const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from the FIXMATE directory
app.use(express.static(path.join(__dirname)));

// Default route: serve fundiregister.html or your main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'homepage.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running at http://localhost:${PORT}`);
});