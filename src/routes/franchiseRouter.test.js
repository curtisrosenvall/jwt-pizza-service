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

    try{
      // Wait for DB initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create unique test users
    const uniqueId = Math.random().toString(36).substring(7);

    // Create and login as admin
    const adminRes = await request(app)
      .put('/api/auth')
      .send({
        email: 'a@jwt.com',
        password: 'admin'
      });
    adminToken = adminRes.body.token;

    // Register test user
    testUser = {
      name: 'Test User',
      email: `test${uniqueId}@test.com`,
      password: 'testpass',
      roles: [{ role: Role.Diner }]
    };
    const testUserRes = await request(app)
      .post('/api/auth')
      .send(testUser);
    testUserToken = testUserRes.body.token;
    testUser.id = testUserRes.body.user.id;

    // Create and register franchise admin
    const franchiseAdmin = {
      name: 'Franchise Admin',
      email: `franchise${uniqueId}@test.com`,
      password: 'adminpass',
      roles: [{ role: Role.Diner }]
    };
    const franchiseAdminRes = await request(app)
      .post('/api/auth')
      .send(franchiseAdmin);
    franchiseAdminToken = franchiseAdminRes.body.token;

    // Create initial test franchise using admin token
    const franchiseRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Test Franchise ${uniqueId}`,
        admins: [{ email: franchiseAdmin.email }]
      });
    testFranchise = franchiseRes.body;

    // Wait for all operations to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    } catch  (error){
      console.error('Setup error:', error);
      throw error;
    }
  });

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
    // Clean up test data
    try {
      const stores = await request(app)
        .get(`/api/franchise/${testFranchise.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (stores.body && stores.body.stores) {
        for (const store of stores.body.stores) {
          await request(app)
            .delete(`/api/franchise/${testFranchise.id}/store/${store.id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        }
      }

      await request(app)
        .delete(`/api/franchise/${testFranchise.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });
});