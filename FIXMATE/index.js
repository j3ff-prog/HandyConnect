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

// --- M-Pesa Sandbox STK Push Endpoint ---
app.post('/api/mpesa-pay', async (req, res) => {
  const { phone, amount } = req.body;

  // Validate input
  if (!phone || !amount) {
    return res.status(400).json({ error: 'Phone and amount are required.' });
  }

  // --- Sandbox credentials ---
  const consumerKey = '1G9GQIxwhmchBt8OWK347TGFEAKPHPmHMXaCPwALEhNApbFT';
  const consumerSecret = 'B2ibJC7IUmw72TbdjQKU0JrfAohey8vg1sJmrzYyto5OBAYIgjfAMzABsJJwi7kF';
  const shortcode = '174379'; // Default sandbox shortcode
  const passkey = 'YOUR_SANDBOX_PASSKEY';
  const callbackUrl = 'https://mydomain.com/mpesa-callback'; // Use any valid URL for sandbox

  // --- Get access token ---
  let accessToken;
  try {
    const tokenRes = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        auth: {
          username: consumerKey,
          password: consumerSecret
        }
      }
    );
    accessToken = tokenRes.data.access_token;
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get M-Pesa access token.' });
  }

  // --- Prepare STK Push request ---
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const password = Buffer.from(shortcode + passkey + timestamp).toString('base64');

  const stkPushPayload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: 'HandyConnect',
    TransactionDesc: 'Service Payment'
  };

  try {
    const stkRes = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkPushPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({ message: 'Sandbox payment initiated. Check your phone (use 2547XXXXXXXX test numbers).' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to initiate sandbox payment.' });
  }
});

app.listen(PORT, () => {
  console.log(`Frontend server running at http://localhost:${PORT}`);
});