const express = require('express');
const morgan = require('morgan'); 
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(morgan('dev')); 
app.use(express.json());
app.use(cors());

// Load local "NoSQL" database
const rawData = fs.readFileSync('./database.json');
const db = JSON.parse(rawData);

// ABAC Middleware: Simulates JWT Scope Validation
const checkPersonaScope = (requiredContext) => {
    return (req, res, next) => {
        // In the real app, this extracts the scope from the JWT.
        // For the prototype, we pass the simulated scope in the Auth header.
        const tokenScope = req.headers.authorization?.split(' ')[1]; // e.g., "Bearer read:profile:gaming"

        if (!tokenScope || tokenScope !== `read:profile:${requiredContext}`) {
            // Gate 2 Requirement: Block mismatched tokens with 403 Forbidden
            return res.status(403).json({
                error: "Forbidden",
                message: `Your access token does not have permission for the ${requiredContext} context.`
            });
        }
        next();
    };
};

// The Context-Aware REST Endpoints
app.get('/api/v1/profiles/:context', (req, res) => {
    const requestedContext = req.params.context; // 'professional', 'social', or 'gaming'
    const userId = "test_user_123"; // Hardcoded for prototype demonstration
    
    // Map the URL param to the database schema keys
    const schemaMap = {
        'professional': 'professional_profile',
        'personal': 'social_profile',
        'gaming': 'gaming_profile'
    };

    const dbKey = schemaMap[requestedContext];

    // Check if the requested context exists
    if (!dbKey) {
        return res.status(400).json({ error: "Bad Request", message: "Invalid persona context." });
    }

    // Run the ABAC check manually for the specific route
    checkPersonaScope(requestedContext)(req, res, () => {
        // If the middleware passes, retrieve the data
        const userRecord = db.users[userId];
        const personaData = userRecord.personas[dbKey];

        // Also fetch the contextual name that matches this persona
        const matchedName = userRecord.contextual_names.find(n => n.context === requestedContext);

        // Return ONLY the data for this specific context
        res.status(200).json({
            status: "success",
            context: requestedContext,
            display_name: matchedName ? matchedName.name_value : "Anonymous",
            data: personaData
        });
    });
});

app.listen(PORT, () => {
    console.log(`Core API Engine running on http://localhost:${PORT}`);
});