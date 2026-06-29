const express = require('express');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '../.env' });

const app = express();

app.use(express.json());

// Initialize Firebase Admin SDK using Secure Environment Variables
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY 
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
        : undefined,
    }),
  });
}

// Get access to the Firestore database tool instance
const db = getFirestore();

// Health Check Route: Test if API is alive online
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: "healthy", message: "API Gateway is running!" });
});

// Fetch User Route: Test if the database connection works properly
app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "Prototype user not found in Firestore collection" });
    }

    // Send back the nested data document safely
    res.status(200).json(userDoc.data());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Local Development Server configuration
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Success! Server running locally on port ${PORT}`);
  });
}

// Export the application configuration for Vercel Serverless Hosting
module.exports = app;