const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());

// Conditionally load morgan logging to prevent test output cluttering
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Read database and cryptographic public keys
const db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
const { publicKey } = JSON.parse(fs.readFileSync('./token-manifest.json', 'utf8'));

const schemaMap = {
  'professional': { dbKey: 'professional_profile', validFields: ['headline', 'linkedin_url', 'resume_url'] },
  'personal': { dbKey: 'social_profile', validFields: ['status_msg', 'location_city', 'birthday_display'] },
  'gaming': { dbKey: 'gaming_profile', validFields: ['clan_tag', 'discord_handle', 'primary_platform'] }
};

// Continuous Cryptographic Verification & ABAC Scope Middleware
const verifyRS256Access = (requiredPersona) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized", message: "Missing authorization token header." });
    }

    const token = authHeader.split(' ')[1];

    try {
      // Validate signature and expiration claims against the public key
      const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
      const scopes = decoded.scope ? decoded.scope.split(' ') : [];
      const requiredScope = `${req.method === 'GET' ? 'read' : 'write'}:profile:${requiredPersona}`;

      if (!scopes.includes(requiredScope)) {
        return res.status(403).json({
          error: "Forbidden",
          message: `Your access token does not have permission for the ${requiredPersona} context.`
        });
      }

      req.userId = decoded.sub;
      next();
    } catch (err) {
      return res.status(401).json({ error: "Unauthorized", message: "Token verification failed or expired.", details: err.message });
    }
  };
};

// GET Endpoints: Enforcing Read Scope Isolation and Response-Time Visibility Sorting
Object.keys(schemaMap).forEach((context) => {
  app.get(`/api/v1/profiles/${context}`, verifyRS256Access(context), (req, res) => {
    const userRecord = db.users[req.userId];
    if (!userRecord) return res.status(404).json({ error: "Not Found", message: "User profile missing." });

    const targetSchema = schemaMap[context];
    const rawPersonaData = userRecord.personas[targetSchema.dbKey];
    
    // Filter out fields with 'private' VisibilityLevel configurations at response-time
    const filteredPersonaData = {};
    Object.keys(rawPersonaData).forEach((field) => {
      if (rawPersonaData[field].visibility === 'public') {
        filteredPersonaData[field] = rawPersonaData[field].value;
      }
    });

    const contextualName = userRecord.contextual_names.find(n => n.context === context);

    res.status(200).json({
      status: "success",
      context: context,
      display_name: contextualName ? contextualName.name_value : "Anonymous",
      data: filteredPersonaData
    });
  });
});

// PATCH Endpoint: Enforcing Boundary Schema Validation Checks to block mass assignment
app.patch('/api/v1/profiles/:persona', (req, res, next) => {
  const persona = req.params.persona;
  if (!schemaMap[persona]) {
    return res.status(400).json({ error: "Bad Request", message: "Invalid profile context target parameters." });
  }
  next();
}, (req, res, next) => {
  verifyRS256Access(req.params.persona)(req, res, next);
}, (req, res) => {
  const persona = req.params.persona;
  const targetSchema = schemaMap[persona];
  const incomingFields = Object.keys(req.body);

  // Schema Validation Check: Block out-of-scope fields completely
  const holdsInvalidFields = incomingFields.some(field => !targetSchema.validFields.includes(field));
  
  if (holdsInvalidFields || incomingFields.length === 0) {
    return res.status(400).json({
      error: "Bad Request",
      message: `Schema violation. Incoming object contains unauthorized parameters for the ${persona} profile.`
    });
  }

  // Fuzz-testing handling simulation: reject abnormally oversized string payloads
  const payloadStringfied = JSON.stringify(req.body);
  if (payloadStringfied.length > 1000) {
     return res.status(400).json({ error: "Bad Request", message: "Payload size threshold violation." });
  }

  // In a real database write occurs here. For local testing, return simulated success payload.
  res.status(200).json({ status: "success", message: `Persona ${persona} modified successfully.`, updatedFields: req.body });
});

module.exports = app;

if (require.main === module) {
  app.listen(3000, () => console.log("Gateway executing on http://localhost:3000"));
}