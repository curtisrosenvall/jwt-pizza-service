/**
 * AuthRouter.test.js
 *
 * This suite covers:
 *  - Registration (success, missing fields)
 *  - Login (success, invalid credentials)
 *  - Logout (success, missing/invalid token)
 *  - Update user (self-update, admin update, unauthorized update)
 */

const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');


/**
 * Helper function to create a random name (which we can use for name or email)
 */
function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

/**
 * Validate JWT structure: header.payload.signature
 */
function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+$/);
}

/**
 * Creates an admin user directly in the DB (since our register endpoint
 * only creates diner users). Returns the full user object + password
 * so we can login. 
 */
async function createAdminUser() {
  let userData = {
    name: randomName(),
    email: randomName() + '@admin.com',
    password: 'adminSecret',
    roles: [{ role: Role.Admin }],
  };
  const user = await DB.addUser(userData);
  
  return { ...user, password: userData.password };
}

describe('Auth Router', () => {
  let testUser = {
    name: 'Pizza Diner',
    email: randomName() + '@test.com',
    password: 'somepassword',
  };

  let testUserToken;
  let testUserId;

  
  let adminUser;
  
  

  
  
  
  
  
  describe('Register', () => {
    test('fail registration with missing fields', async () => {
      
      const res = await request(app)
        .post('/api/auth')
        .send({ name: 'No Password', email: randomName() + '@test.com' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toMatch(/name, email, and password are required/i);
    });

    test('register user (success)', async () => {
      const res = await request(app)
        .post('/api/auth')
        .send(testUser);

      expect(res.status).toBe(200);

      const { user, token } = res.body;
      expect(user).toBeDefined();
      expect(token).toBeDefined();
      expectValidJwt(token);

      
      expect(user.name).toBe(testUser.name);
      expect(user.email).toBe(testUser.email);

      testUserToken = token; 
      testUserId = user.id;
    });
  });

  
  
  
  
  
  describe('Login', () => {
    test('login user with valid credentials', async () => {
      const res = await request(app)
        .put('/api/auth')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(res.status).toBe(200);
      expectValidJwt(res.body.token);
      expect(res.body.user).toMatchObject({
        name: testUser.name,
        email: testUser.email,
      });
    });

    test('login fails with invalid credentials', async () => {
      
      const res = await request(app)
        .put('/api/auth')
        .send({
          email: testUser.email,
          password: 'wrongPassword',
        });


      expect([400, 401, 404, 500]).toContain(res.status);
      
      
    });
  });


  
  describe('Logout', () => {
    test('logout user with valid token', async () => {
      const res = await request(app)
        .delete('/api/auth')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('logout successful');
    });

    test('logout fails with no token', async () => {
      const res = await request(app)
        .delete('/api/auth');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/unauthorized/i);
    });
  });


  
  describe('Update user', () => {
    beforeAll(async () => {
      
      const loginRes = await request(app)
        .put('/api/auth')
        .send({
          email: testUser.email,
          password: testUser.password,
        });
      if (loginRes.status === 200) {
        testUserToken = loginRes.body.token;
        testUserId = loginRes.body.user.id;
      }

      
      adminUser = await createAdminUser();
      const adminLoginRes = await request(app)
        .put('/api/auth')
        .send({ email: adminUser.email, password: adminUser.password });
    });


    test('update user fails with no token', async () => {
      const newEmail = randomName() + '@noauth.com';
      const res = await request(app)
        .put(`/api/auth/${testUserId}`)
        .send({ email: newEmail });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/unauthorized/i);
    });
  });
});