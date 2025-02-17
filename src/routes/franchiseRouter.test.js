const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
const adminUser = { email: 'admin@test.com', password: 'admin' };
const franchiseAdmin = { name: 'franchise admin', email: 'franchise@test.com', password: 'pass' };

let testUserAuthToken;
let adminAuthToken;
let franchiseAdminToken;
let testFranchise;

beforeAll(async () => {
    // Create unique emails
    testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    franchiseAdmin.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  
    // Register test user with diner role
    const registerRes = await request(app)
      .post('/api/auth')
      .send(testUser);
    testUserAuthToken = registerRes.body.token;
    testUser.id = registerRes.body.user.id;
  
    // Register franchise admin
    const franchiseRegisterRes = await request(app)
      .post('/api/auth')
      .send(franchiseAdmin);
    franchiseAdminToken = franchiseRegisterRes.body.token;
    franchiseAdmin.id = franchiseRegisterRes.body.user.id;
  
    // Use the default admin credentials (these should match what's in your database)
    const adminLoginRes = await request(app)
      .put('/api/auth')
      .send({
        email: 'a@jwt.com',  // Use the default admin email from your database initialization
        password: 'admin'    // Use the default admin password
      });
    adminAuthToken = adminLoginRes.body.token;
  
    // Create a test franchise using admin token
    const franchiseRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send({
        name: `Test Franchise ${Math.random()}`,  // Make name unique
        admins: [{ email: franchiseAdmin.email }]
      });
    testFranchise = franchiseRes.body;
  });

describe('Get Franchises', () => {
  test('should list all franchises without auth', async () => {
    const response = await request(app)
      .get('/api/franchise');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('should get user franchises as admin', async () => {
    const response = await request(app)
      .get(`/api/franchise/${franchiseAdmin.id}`)
      .set('Authorization', `Bearer ${adminAuthToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('user should get their own franchises', async () => {
    const response = await request(app)
      .get(`/api/franchise/${franchiseAdmin.id}`)
      .set('Authorization', `Bearer ${franchiseAdminToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('user should not get other user franchises', async () => {
    const response = await request(app)
      .get(`/api/franchise/${franchiseAdmin.id}`)
      .set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

describe('Create Franchise', () => {
    test('admin should create franchise', async () => {
      const newFranchise = {
        name: `Test Franchise ${Math.random().toString(36).substring(7)}`,
        admins: [{ email: 'a@jwt.com' }] // Use admin's email
      };
  
      const response = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(newFranchise);
  
      expect(response.status).toBe(200);
      expect(response.body.name).toBe(newFranchise.name);
    });
  

  test('non-admin cannot create franchise', async () => {
    const newFranchise = {
      name: 'Unauthorized Franchise',
      admins: [{ email: franchiseAdmin.email }]
    };

    const response = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${testUserAuthToken}`)
      .send(newFranchise);

    expect(response.status).toBe(403);
  });

  test('should fail without auth token', async () => {
    const response = await request(app)
      .post('/api/franchise')
      .send({ name: 'No Auth Franchise' });

    expect(response.status).toBe(401);
  });
});

describe('Create Store', () => {
  test('admin should create store', async () => {
    const newStore = {
      name: 'Test Store'
    };

    const response = await request(app)
      .post(`/api/franchise/${testFranchise.id}/store`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(newStore);

    expect(response.status).toBe(200);
    expect(response.body.name).toBe(newStore.name);
  });

  test('franchise admin should create store', async () => {
    const newStore = {
      name: 'Franchise Admin Store'
    };

    const response = await request(app)
      .post(`/api/franchise/${testFranchise.id}/store`)
      .set('Authorization', `Bearer ${franchiseAdminToken}`)
      .send(newStore);

    expect(response.status).toBe(200);
    expect(response.body.name).toBe(newStore.name);
  });

  test('regular user cannot create store', async () => {
    const newStore = {
      name: 'Unauthorized Store'
    };

    const response = await request(app)
      .post(`/api/franchise/${testFranchise.id}/store`)
      .set('Authorization', `Bearer ${testUserAuthToken}`)
      .send(newStore);

    expect(response.status).toBe(403);
  });
});

describe('Delete Franchise', () => {
  let franchiseToDelete;

  beforeEach(async () => {
    // Create a franchise to delete
    const franchiseRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send({
        name: `Franchise to Delete ${Math.random()}`,
        admins: [{ email: franchiseAdmin.email }]
      });
    franchiseToDelete = franchiseRes.body;
  });

  test('admin should delete franchise', async () => {
    const response = await request(app)
      .delete(`/api/franchise/${franchiseToDelete.id}`)
      .set('Authorization', `Bearer ${adminAuthToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('franchise deleted');
  });

  test('non-admin cannot delete franchise', async () => {
    const response = await request(app)
      .delete(`/api/franchise/${franchiseToDelete.id}`)
      .set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(response.status).toBe(403);
  });
});

describe('Delete Store', () => {
  let testStore;

  beforeEach(async () => {
    // Create a store to delete
    const storeRes = await request(app)
      .post(`/api/franchise/${testFranchise.id}/store`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send({ name: 'Store to Delete' });
    testStore = storeRes.body;
  });

  test('admin should delete store', async () => {
    const response = await request(app)
      .delete(`/api/franchise/${testFranchise.id}/store/${testStore.id}`)
      .set('Authorization', `Bearer ${adminAuthToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('store deleted');
  });

  test('franchise admin should delete store', async () => {
    const response = await request(app)
      .delete(`/api/franchise/${testFranchise.id}/store/${testStore.id}`)
      .set('Authorization', `Bearer ${franchiseAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('store deleted');
  });

  test('regular user cannot delete store', async () => {
    const response = await request(app)
      .delete(`/api/franchise/${testFranchise.id}/store/${testStore.id}`)
      .set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(response.status).toBe(403);
  });
});