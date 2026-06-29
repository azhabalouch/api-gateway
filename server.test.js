const request = require('supertest');
const app = require('./server');
const fs = require('fs');

const { tokens } = JSON.parse(fs.readFileSync('./token-manifest.json', 'utf8'));

describe('Centralised API Gateway Comprehensive Verification Suite', () => {
  
  // 1. Happy Path Operational Isolation Tests
  test('GET /profiles/gaming with valid scope returns public data and hides hidden fields', async () => {
    const res = await request(app)
      .get('/api/v1/profiles/gaming')
      .set('Authorization', `Bearer ${tokens.gaming}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.display_name).toBe('ShadowGamer');
    expect(res.body.data).toHaveProperty('clan_tag');
    expect(res.body.data).not.toHaveProperty('birthday_display'); // Structural data isolation confirmation
  });

  // 2. Out-of-Context Injection Attacking Tests (Context Collapse Mitigations)
  test('GET /profiles/professional with a gaming scope token throws 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/v1/profiles/professional')
      .set('Authorization', `Bearer ${tokens.gaming}`); // Identity cross-contamination attempt
    
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('permission for the professional context');
  });

  // 3. Lifecycle Compromise and Expired Validation Error Path Tests
  test('GET /profiles/gaming with an expired token signature throws 401 Unauthorized', async () => {
    const res = await request(app)
      .get('/api/v1/profiles/gaming')
      .set('Authorization', `Bearer ${tokens.expired}`);
    
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(res.body.message).toContain('verification failed or expired');
  });

  // 4. Missing Authorization Component Request Vectors
  test('GET /profiles/personal omitting header throws 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/profiles/personal');
    expect(res.statusCode).toBe(401);
  });

  // 5. PATCH Schema Protection Boundaries & Payload Structural Fuzzing Tests
  test('PATCH /profiles/gaming rejects data modifications containing out-of-scope attributes', async () => {
    const res = await request(app)
      .patch('/api/v1/profiles/gaming')
      .set('Authorization', `Bearer ${tokens.gaming}`)
      .send({ 
        clan_tag: "[NEW]", 
        linkedin_url: "https://attack.vector/malicious" // Malicious parameter injection attempt
      });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Bad Request');
    expect(res.body.message).toContain('Schema violation');
  });

  test('PATCH /profiles/professional rejects oversized structural payloads', async () => {
    const massivePayload = { headline: "A".repeat(1200) };
    const res = await request(app)
      .patch('/api/v1/profiles/professional')
      .set('Authorization', `Bearer ${tokens.professional}`)
      .send(massivePayload);
    
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('Payload size threshold violation');
  });
});