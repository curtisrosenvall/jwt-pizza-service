const request = require('supertest');
const app = require('../service');
// const { Role } = require('../database/database.js');

describe('Auth Router', () => {
  let testUser;
  let adminAuthToken;  // Changed from adminToken to adminAuthToken for consistency
  let testUserAuthToken;

  beforeAll(async () => {
    // Wait for database initialization
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Create test user
      testUser = {
        name: 'Test User',
        email: `test${Math.random().toString(36).substring(7)}@test.com`,
        password: 'testpass'
      };

      // Register test user
      const registerRes = await request(app)
        .post('/api/auth')
        .send(testUser);
      testUserAuthToken = registerRes.body.token;
      testUser.id = registerRes.body.user.id;

      // Login as admin
      const adminLoginRes = await request(app)
        .put('/api/auth')
        .send({
          email: 'a@jwt.com',
          password: 'admin'
        });
      adminAuthToken = adminLoginRes.body.token;  // Store admin token

      // Add delay to ensure setup is complete
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  });

  describe('Registration', () => {
    test('should register a new user successfully', async () => {
      const newUser = {
        name: 'New User',
        email: `test${Math.random().toString(36).substring(7)}@test.com`,
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth')
        .send(newUser);

      expect(response.status).toBe(200);
      expect(response.body.user.name).toBe(newUser.name);
      expect(response.body.user.email).toBe(newUser.email);
      expect(response.body.user.roles).toEqual([{ role: 'diner' }]);
      expect(response.body.token).toBeDefined();
    });

    test('should fail registration with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth')
        .send({ name: 'Incomplete User' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('name, email, and password are required');
    });
  });

  describe('Login', () => {
    test('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .put('/api/auth')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
    });

    test('should fail login with incorrect credentials', async () => {
      const response = await request(app)
        .put('/api/auth')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('User Updates', () => {
    test('should allow user to update their own details', async () => {
      const updates = {
        email: `updated${Math.random().toString(36).substring(7)}@test.com`,
        password: 'newpassword'
      };

      const response = await request(app)
        .put(`/api/auth/${testUser.id}`)
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe(updates.email);
    });

    test('should allow admin to update other users', async () => {
      const updates = {
        email: `adminupdated${Math.random().toString(36).substring(7)}@test.com`,
        password: 'adminupdated'
      };

      const response = await request(app)
        .put(`/api/auth/${testUser.id}`)
        .set('Authorization', `Bearer ${adminAuthToken}`)  // Using adminAuthToken consistently
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe(updates.email);
    });
  });

  describe('Logout', () => {
    test('should logout successfully', async () => {
      const response = await request(app)
        .delete('/api/auth')
        .set('Authorization', `Bearer ${testUserAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('logout successful');
    });

    test('should fail logout without auth token', async () => {
      const response = await request(app)
        .delete('/api/auth');

      expect(response.status).toBe(401);
    });
  });

  afterAll(async () => {
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
});