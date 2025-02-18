const request = require('supertest');
const app = require('../service');
const { Role } = require('../database/database.js');

describe('Franchise Router', () => {
  let testUser;
  let adminToken;
  let testUserToken;
  let franchiseAdminToken;
  let testFranchise;

  beforeAll(async () => {
    // Wait for database initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
  
    try {
      // Login as admin first
      const adminLoginRes = await request(app)
        .put('/api/auth')
        .send({
          email: 'a@jwt.com',
          password: 'admin'
        });
      
      adminToken = adminLoginRes.body.token;
      await waitForAuth(adminToken);
  
      // Create test user
      testUser = {
        name: 'Test User',
        email: `test${Math.random().toString(36).substring(7)}@test.com`,
        password: 'testpass'
      };
  
      const registerRes = await request(app)
        .post('/api/auth')
        .send(testUser);
      testUserToken = registerRes.body.token;
      testUser.id = registerRes.body.user.id;
      await waitForAuth(testUserToken);
  
      // Create and register franchise admin
      franchiseAdmin = {
        name: 'Franchise Admin',
        email: `franchise${Math.random().toString(36).substring(7)}@test.com`,
        password: 'franchisepass'
      };
  
      const franchiseAdminRes = await request(app)
        .post('/api/auth')
        .send(franchiseAdmin);
      franchiseAdminToken = franchiseAdminRes.body.token;
      franchiseAdmin.id = franchiseAdminRes.body.user.id;
      await waitForAuth(franchiseAdminToken);
  
      // Create test franchise
      const franchiseRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Test Franchise ${Math.random().toString(36).substring(7)}`,
          admins: [{ email: franchiseAdmin.email }]
        });
      testFranchise = franchiseRes.body;
  
      // Add delay to ensure all operations are complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Setup error:', error);
      throw error;
    }
  });

  const waitForAuth = async (token) => {
    let attempts = 0;
    while (attempts < 3) {
      try {
        const testResponse = await request(app)
          .get('/api/franchise')
          .set('Authorization', `Bearer ${token}`);
        if (testResponse.status !== 401) {
          return;
        }
      } catch (error) {
        console.log('Auth check failed, retrying...');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    throw new Error('Auth setup failed');
  };

  describe('Get Franchises', () => {
    test('should list all franchises without auth', async () => {
      const response = await request(app)
        .get('/api/franchise');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('admin should get all franchises', async () => {
      const response = await request(app)
        .get('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('user should get their own franchises', async () => {
      const response = await request(app)
        .get(`/api/franchise/${testUser.id}`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Create Franchise', () => {
    let franchiseCount = 0;

    // test('admin should create franchise', async () => {
    //   const newFranchise = {
    //     name: `New Franchise ${franchiseCount++}`,
    //     admins: [{ email: 'a@jwt.com' }]
    //   };

    //   const response = await request(app)
    //     .post('/api/franchise')
    //     .set('Authorization', `Bearer ${adminToken}`)
    //     .send(newFranchise);

    //   expect(response.status).toBe(200);
    //   expect(response.body.name).toBe(newFranchise.name);
    // });

    test('non-admin cannot create franchise', async () => {
      const response = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          name: `New Franchise ${franchiseCount++}`,
          admins: [{ email: testUser.email }]
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Store Operations', () => {
    let storeCount = 0;

    test('admin should create store', async () => {
      const response = await request(app)
        .post(`/api/franchise/${testFranchise.id}/store`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Test Store ${storeCount++}`
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name');
    });

    test('franchise admin should create store', async () => {
      const response = await request(app)
        .post(`/api/franchise/${testFranchise.id}/store`)
        .set('Authorization', `Bearer ${franchiseAdminToken}`)
        .send({
          name: `Test Store ${storeCount++}`
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name');
    });

    test('regular user cannot create store', async () => {
      const response = await request(app)
        .post(`/api/franchise/${testFranchise.id}/store`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          name: `Test Store ${storeCount++}`
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Delete Operations', () => {
    let storeToDelete;

    beforeEach(async () => {
      // Create a store to delete
      const storeRes = await request(app)
        .post(`/api/franchise/${testFranchise.id}/store`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Store to Delete' });
      storeToDelete = storeRes.body;
    });

    test('admin should delete store', async () => {
      const response = await request(app)
        .delete(`/api/franchise/${testFranchise.id}/store/${storeToDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('store deleted');
    });

    test('franchise admin should delete store', async () => {
      const response = await request(app)
        .delete(`/api/franchise/${testFranchise.id}/store/${storeToDelete.id}`)
        .set('Authorization', `Bearer ${franchiseAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('store deleted');
    });
  });

  afterAll(async () => {
    try {
      // Clean up in reverse order
      await request(app)
        .delete(`/api/auth`)
        .set('Authorization', `Bearer ${testUserToken}`);
      
      await request(app)
        .delete(`/api/auth`)
        .set('Authorization', `Bearer ${franchiseAdminToken}`);
      
      await request(app)
        .delete(`/api/auth`)
        .set('Authorization', `Bearer ${adminToken}`);
  
      // Wait for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });
});