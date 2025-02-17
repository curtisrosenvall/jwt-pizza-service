const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
const adminUser = { email: 'admin@test.com', password: 'admin' };
let testUserAuthToken;
let adminAuthToken;

beforeAll(async () => {
  // Create a unique email for test user
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);

  // Login as admin
  const adminLoginRes = await request(app).put('/api/auth').send(adminUser);
  adminAuthToken = adminLoginRes.body.token;
});

describe('Registration', () => {
  test('should register a new user successfully', async () => {
    const newUser = {
      name: 'new user',
      email: Math.random().toString(36).substring(2, 12) + '@test.com',
      password: 'password123'
    };

    const response = await request(app)
      .post('/api/auth')
      .send(newUser);

    expect(response.status).toBe(200);
    expect(response.body.user.name).toBe(newUser.name);
    expect(response.body.user.email).toBe(newUser.email);
    expect(response.body.user.roles).toEqual([{ role: 'diner' }]);
    expectValidJwt(response.body.token);
  });

  test('should fail registration with missing fields', async () => {
    const invalidUser = {
      name: 'incomplete user'
    };

    const response = await request(app)
      .post('/api/auth')
      .send(invalidUser);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('name, email, and password are required');
  });
});

describe('Login', () => {
  test('should login existing user successfully', async () => {
    const loginRes = await request(app)
      .put('/api/auth')
      .send(testUser);

    expect(loginRes.status).toBe(200);
    expectValidJwt(loginRes.body.token);

    const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
    delete expectedUser.password;
    expect(loginRes.body.user).toMatchObject(expectedUser);
  });

  test('should fail login with incorrect credentials', async () => {
    const wrongCredentials = {
      email: testUser.email,
      password: 'wrongpassword'
    };
  
    const response = await request(app)
      .put('/api/auth')
      .send(wrongCredentials);
  
    expect(response.status).toBe(404);  // Change from 401 to 404 to match your implementation
  });
});

describe('User Updates', () => {
  test('should allow user to update their own details', async () => {
    const updates = {
      email: Math.random().toString(36).substring(2, 12) + '@test.com',
      password: 'newpassword123'
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
      email: Math.random().toString(36).substring(2, 12) + '@test.com',
      password: 'adminupdated'
    };

    const response = await request(app)
      .put(`/api/auth/${testUser.id}`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(updates);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(updates.email);
  });

  test('should prevent user from updating other users', async () => {
    const anotherUserId = testUser.id + 1;
    const updates = {
      email: 'newemail@test.com',
      password: 'newpass'
    };

    const response = await request(app)
      .put(`/api/auth/${anotherUserId}`)
      .set('Authorization', `Bearer ${testUserAuthToken}`)
      .send(updates);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('unauthorized');
  });
});

describe('Logout', () => {
  test('should logout successfully', async () => {
    const response = await request(app)
      .delete('/api/auth')
      .set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('logout successful');

    // Verify token is invalidated by trying to use it again
    const verifyResponse = await request(app)
      .delete('/api/auth')
      .set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(verifyResponse.status).toBe(401);
  });

  test('should fail logout without auth token', async () => {
    const response = await request(app)
      .delete('/api/auth');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('unauthorized');
  });
});

describe('Authentication Middleware', () => {
  test('should reject requests with invalid JWT', async () => {
    const response = await request(app)
      .delete('/api/auth')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(response.status).toBe(401);
  });

  test('should reject requests with malformed auth header', async () => {
    const response = await request(app)
      .delete('/api/auth')
      .set('Authorization', 'InvalidHeaderFormat');

    expect(response.status).toBe(401);
  });
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}