const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');

// Generate an RSA Keypair to simulate the decoupled Identity Provider (IdP)
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
});

const payloadBase = { sub: "test_user_123", iss: "decoupled-idp.local" };

// Compile token configurations to satisfy strict verification conditions
const tokens = {
  professional: jwt.sign({ ...payloadBase, scope: "read:profile:professional write:profile:professional" }, privateKey, { algorithm: 'RS256', expiresIn: '1h' }),
  gaming: jwt.sign({ ...payloadBase, scope: "read:profile:gaming write:profile:gaming" }, privateKey, { algorithm: 'RS256', expiresIn: '1h' }),
  personal: jwt.sign({ ...payloadBase, scope: "read:profile:personal write:profile:personal" }, privateKey, { algorithm: 'RS256', expiresIn: '1h' }),
  expired: jwt.sign({ ...payloadBase, scope: "read:profile:gaming" }, privateKey, { algorithm: 'RS256', expiresIn: '-1h' })
};

const manifest = { publicKey, tokens };
fs.writeFileSync('./token-manifest.json', JSON.stringify(manifest, null, 2));
console.log("Asymmetric RSA keys and token manifest compiled successfully.");