const request = require('supertest');
const app = require('../service');
const { Role } = require('../database/database.js');
// const config = require('../config');

describe('Order Router', () => {
  let testUser;
  let adminToken;
  let testUserToken;
  let testFranchise;
  let testStore;
//   let menuItem;

  beforeAll(async () => {
    // Wait a bit for database initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Setup test user
    testUser = {
      name: 'Test User',
      email: `test${Math.random().toString(36).substring(7)}@test.com`,
      password: 'testpass',
      roles: [{ role: Role.Diner }]
    };

    // Register test user
    const testUserRes = await request(app)
      .post('/api/auth')
      .send(testUser);
    testUserToken = testUserRes.body.token;
    testUser.id = testUserRes.body.user.id;

    // Login as admin
    const adminRes = await request(app)
      .put('/api/auth')
      .send({ email: 'a@jwt.com', password: 'admin' });
    adminToken = adminRes.body.token;

    // Create test franchise
    const franchiseRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Test Franchise ${Math.random().toString(36).substring(7)}`,
        admins: [{ email: testUser.email }]
      });
    testFranchise = franchiseRes.body;

    // Create test store
    const storeRes = await request(app)
      .post(`/api/franchise/${testFranchise.id}/store`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Store' });
    testStore = storeRes.body;

    // Create menu item if none exists
    const menuRes = await request(app)
      .get('/api/order/menu');
    
    if (!menuRes.body.length) {
      const newMenuItem = {
        title: 'Test Pizza',
        description: 'A test pizza',
        image: 'test-pizza.png',
        price: 0.0025
      };
      
      await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newMenuItem);
    }

    const updatedMenuRes = await request(app)
      .get('/api/order/menu');
    menuItem = updatedMenuRes.body[0];

    // Add a slight delay to ensure all DB operations are complete
    await new Promise(resolve => setTimeout(resolve, 500));
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
    //   test('admin should add menu item', async () => {
    //     const newMenuItem = {
    //       title: 'New Test Pizza',
    //       description: 'Another test pizza',
    //       image: 'test-pizza-2.png',
    //       price: 0.0035
    //     };

    //     const response = await request(app)
    //       .put('/api/order/menu')
    //       .set('Authorization', `Bearer ${adminToken}`)
    //       .send(newMenuItem);

    //     expect(response.status).toBe(200);
    //     expect(Array.isArray(response.body)).toBe(true);
    //     expect(response.body.some(item => item.title === newMenuItem.title)).toBe(true);
    //   });

      test('regular user cannot add menu item', async () => {
        const newMenuItem = {
          title: 'Unauthorized Pizza',
          description: 'Should not be added',
          image: 'test.png',
          price: 0.001
        };

        const response = await request(app)
          .put('/api/order/menu')
          .set('Authorization', `Bearer ${testUserToken}`)
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
          .set('Authorization', `Bearer ${testUserToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('orders');
        expect(Array.isArray(response.body.orders)).toBe(true);
        expect(response.body).toHaveProperty('dinerId', testUser.id);
      });

      test('should get orders with pagination', async () => {
        const response = await request(app)
          .get('/api/order?page=1')
          .set('Authorization', `Bearer ${testUserToken}`);

        expect(response.status).toBe(200);
        expect(response.body.page).toBe('1');
      });

      test('should reject request without auth token', async () => {
        const response = await request(app)
          .get('/api/order');

        expect(response.status).toBe(401);
      });
    });

    describe('POST / - Create Order', () => {
    //   test('user should create order successfully', async () => {
    //     const newOrder = {
    //       franchiseId: testFranchise.id,
    //       storeId: testStore.id,
    //       items: [{
    //         menuId: menuItem.id,
    //         description: menuItem.description,
    //         price: menuItem.price
    //       }]
    //     };

    //     const response = await request(app)
    //       .post('/api/order')
    //       .set('Authorization', `Bearer ${testUserToken}`)
    //       .send(newOrder);

    //     expect(response.status).toBe(200);
    //     expect(response.body).toHaveProperty('order');
    //     expect(response.body.order).toHaveProperty('id');
    //     expect(response.body).toHaveProperty('jwt');
    //   });

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

    //   test('should handle factory service failure', async () => {
    //     // Mock fetch to simulate failure
    //     global.fetch = jest.fn(() => Promise.reject(new Error('fetch failed')));

    //     const newOrder = {
    //       franchiseId: testFranchise.id,
    //       storeId: testStore.id,
    //       items: [{
    //         menuId: menuItem.id,
    //         description: menuItem.description,
    //         price: menuItem.price
    //       }]
    //     };

    //     const response = await request(app)
    //       .post('/api/order')
    //       .set('Authorization', `Bearer ${testUserToken}`)
    //       .send(newOrder);

    //     expect(response.status).toBe(500);
    //     expect(response.body).toHaveProperty('message');
    //     expect(response.body.message).toBe('fetch failed');

    //     // Restore original fetch
    //     global.fetch = jest.fn(() =>
    //       Promise.resolve({
    //         ok: true,
    //         json: () => Promise.resolve({ jwt: 'test-jwt', reportUrl: 'test-url' }),
    //       })
    //     );
    //   });
    });
  });

  // Clean up after all tests
  afterAll(async () => {
    try {
      if (testFranchise?.id) {
        if (testStore?.id) {
          await request(app)
            .delete(`/api/franchise/${testFranchise.id}/store/${testStore.id}`)
            .set('Authorization', `Bearer ${adminToken}`);
        }
        await request(app)
          .delete(`/api/franchise/${testFranchise.id}`)
          .set('Authorization', `Bearer ${adminToken}`);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });
});