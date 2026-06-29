const express = require('express');
const morgan = require('morgan'); 
const cors = require('cors');

const app = express();
const PORT = 3000; // Local port for your backend

// Basic logging and middleware
app.use(morgan('dev')); 
app.use(express.json());
app.use(cors()); // Allows your local React app to talk to this local server

// Gate 1: Hello World Route
app.get('/api/v1', (req, res) => {
    res.status(200).json({ 
        status: "success",
        message: "Hello World from the local API Gateway!" 
    });
});

// Standard local server listener
app.listen(PORT, () => {
    console.log(`Gateway running locally on http://localhost:${PORT}`);
});