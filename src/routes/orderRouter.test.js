const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
const adminUser = { email: 'a@jwt.com', password: 'admin' };
let testUserAuthToken;
let adminAuthToken;

beforeAll(async () => {
  // Create unique email for test user
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUser.id = registerRes.body.user.id;

  // Login as admin
  const adminLoginRes = await request(app).put('/api/auth').send(adminUser);
  adminAuthToken = adminLoginRes.body.token;
});

describe('Menu Operations', () => {
  describe('GET /menu - Get Menu', () => {
    test('should get menu without authentication', async () => {
      const response = await request(app)
        .get('/api/order/menu');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('PUT /menu - Add Menu Item', () => {
    test('admin should add menu item', async () => {
      const newMenuItem = {
        title: 'Test Pizza',
        description: 'A test pizza',
        image: 'test-pizza.png',
        price: 0.0025
      };

      const response = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(newMenuItem);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some(item => item.title === newMenuItem.title)).toBe(true);
    });

    test('regular user cannot add menu item', async () => {
      const newMenuItem = {
        title: 'Unauthorized Pizza',
        description: 'Should not be added',
        image: 'test.png',
        price: 0.001
      };

      const response = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send(newMenuItem);

      expect(response.status).toBe(403);
    });

    test('should reject request without auth token', async () => {
      const response = await request(app)
        .put('/api/order/menu')
        .send({
          title: 'No Auth Pizza',
          description: 'Should fail',
          image: 'test.png',
          price: 0.001
        });

      expect(response.status).toBe(401);
    });
  });
});

describe('Order Operations', () => {
  describe('GET / - Get Orders', () => {
    test('user should get their orders', async () => {
      const response = await request(app)
        .get('/api/order')
        .set('Authorization', `Bearer ${testUserAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('orders');
      expect(Array.isArray(response.body.orders)).toBe(true);
      expect(response.body).toHaveProperty('dinerId', testUser.id);
    });

    test('should get orders with pagination', async () => {
      const response = await request(app)
        .get('/api/order?page=1')
        .set('Authorization', `Bearer ${testUserAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('page', 1);
    });

    test('should reject request without auth token', async () => {
      const response = await request(app)
        .get('/api/order');

      expect(response.status).toBe(401);
    });
  });

  describe('POST / - Create Order', () => {
    let testFranchise;
    let testStore;
    let menuItem;

    beforeAll(async () => {
      // Create a test franchise
      const franchiseRes = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({
          name: `Test Franchise ${Math.random()}`,
          admins: [{ email: testUser.email }]
        });
      testFranchise = franchiseRes.body;

      // Create a test store
      const storeRes = await request(app)
        .post(`/api/franchise/${testFranchise.id}/store`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({ name: 'Test Store' });
      testStore = storeRes.body;

      // Get menu items
      const menuRes = await request(app)
        .get('/api/order/menu');
      menuItem = menuRes.body[0];
    });

    test('user should create order successfully', async () => {
      const newOrder = {
        franchiseId: testFranchise.id,
        storeId: testStore.id,
        items: [{
          menuId: menuItem.id,
          description: menuItem.description,
          price: menuItem.price
        }]
      };

      const response = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send(newOrder);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('order');
      expect(response.body.order).toHaveProperty('id');
      expect(response.body).toHaveProperty('jwt');
    });

    test('should reject order without auth token', async () => {
      const response = await request(app)
        .post('/api/order')
        .send({
          franchiseId: testFranchise.id,
          storeId: testStore.id,
          items: []
        });

      expect(response.status).toBe(401);
    });

    test('should handle factory service failure', async () => {
      // Modify config to point to invalid factory URL
      const originalUrl = config.factory.url;
      config.factory.url = 'http://invalid-url';

      const newOrder = {
        franchiseId: testFranchise.id,
        storeId: testStore.id,
        items: [{
          menuId: menuItem.id,
          description: menuItem.description,
          price: menuItem.price
        }]
      };

      const response = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${testUserAuthToken}`)
        .send(newOrder);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Failed to fulfill order at factory');

      // Restore original URL
      config.factory.url = originalUrl;
    });
  });
});