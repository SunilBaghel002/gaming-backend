const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Ably = require('ably');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Define Response Schema
const ResponseSchema = new mongoose.Schema({
  response: { type: String, required: true, enum: ['yes', 'no'] },
  timestamp: { type: Date, default: Date.now },
});
const Response = mongoose.model('Response', ResponseSchema);

// Initialize Ably
const ably = new Ably.Realtime({ key: process.env.ABLY_API_KEY });
const channel = ably.channels.get('responses');

// POST endpoint to save and publish response
app.post('/api/response', async (req, res) => {
  const { response } = req.body;
  if (!response || !['yes', 'no'].includes(response)) {
    return res.status(400).json({ error: 'Invalid response. Must be "yes" or "no"' });
  }

  try {
    // Save to MongoDB
    await Response.create({ response });
    // Publish to Ably
    channel.publish('response', { response });
    res.status(200).json({ message: 'Response sent' });
  } catch (err) {
    console.error('Error saving response:', err);
    res.status(500).json({ error: 'Error saving response' });
  }
});

// GET endpoint to fetch response counts
app.get('/api/responses', async (req, res) => {
  try {
    const responses = await Response.aggregate([
      { $group: { _id: '$response', count: { $sum: 1 } } },
    ]);
    res.status(200).json(responses);
  } catch (err) {
    console.error('Error fetching responses:', err);
    res.status(500).json({ error: 'Error fetching responses' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));