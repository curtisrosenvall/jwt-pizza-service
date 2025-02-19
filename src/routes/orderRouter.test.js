/**
 * orderRouter.test.js
 *
 * Tests the /api/order routes:
 *  - GET /api/order/menu        -> Public: returns the pizza menu
 *  - PUT /api/order/menu        -> Admin only: add a new menu item
 *  - GET /api/order             -> Auth only: get current user's orders
 *  - POST /api/order            -> Auth only: create a new order
 *
 * Make sure you have:
 *   - a globalSetup to create DB/tables and seed default admin (if you rely on a@jwt.com).
 *   - or you manually create an admin user below if needed.
 */

const request = require('supertest');
const app = require('../service');
const { DB, Role } = require('../database/database');

// Utility to create a random name for test items
function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

/**
 * Directly create an Admin user in the DB, then log them in.
 * Returns { user, token }
 */
async function createAndLoginAdmin() {
  // 1) add user with role Admin
  const adminData = {
    name: 'Test Admin ' + randomName(),
    email: randomName() + '@admin.com',
    password: 'secretAdmin',
    roles: [{ role: Role.Admin }],
  };
  const newAdmin = await DB.addUser(adminData);

  // 2) login via /api/auth
  const loginRes = await request(app)
    .put('/api/auth')
    .send({ email: adminData.email, password: adminData.password });
  if (loginRes.status !== 200) {
    throw new Error(
      `Admin login failed: ${loginRes.status} => ${loginRes.text}`
    );
  }

  return { user: newAdmin, token: loginRes.body.token };
}

/**
 * Creates a Diner user with the normal /api/auth register route,
 * then logs them in so we have a token.
 */
async function createAndLoginDiner() {
  const userData = {
    name: 'Test Diner ' + randomName(),
    email: randomName() + '@test.com',
    password: 'somepass',
  };
  // Register
  const registerRes = await request(app).post('/api/auth').send(userData);
  if (registerRes.status !== 200) {
    throw new Error(
      `Diner registration failed: ${registerRes.status} => ${registerRes.text}`
    );
  }
  // We get a token right away from register
  return { user: registerRes.body.user, token: registerRes.body.token };
}

// Increase test timeout if your DB is slow:
jest.setTimeout(30000);

describe('Order Router', () => {
  let adminToken;
//   let adminUser;
  let dinerToken;
  let dinerUser;

  beforeAll(async () => {
    // 1) Create/login an admin
    const admin = await createAndLoginAdmin();
    adminToken = admin.token;
    adminUser = admin.user;

    // 2) Create/login a diner
    const diner = await createAndLoginDiner();
    dinerToken = diner.token;
    dinerUser = diner.user;
  });

  //
  // ------------------------------------------------------------
  // 1. GET /api/order/menu
  // ------------------------------------------------------------
  //
  describe('GET /api/order/menu', () => {
    test('should return an array of menu items (no auth needed)', async () => {
      const res = await request(app).get('/api/order/menu');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Possibly check the shape if you have default items seeded
      // e.g., expect(res.body).toHaveLength(0); if no default items exist
    });
  });

  //
  // ------------------------------------------------------------
  // 2. PUT /api/order/menu - add a menu item
  // ------------------------------------------------------------
  //
  describe('PUT /api/order/menu', () => {
    test('403 if non-admin tries to add a menu item', async () => {
      const res = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${dinerToken}`)
        .send({
          title: 'Test Pizza',
          description: 'Diner tries to add menu item',
          image: 'pizza-test.png',
          price: 1.99,
        });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/unable to add menu item/i);
    });

    test('success if admin user adds a new menu item', async () => {
      const newItem = {
        title: 'Admin Pizza ' + randomName(),
        description: 'Added by admin user test',
        image: 'pizza-new.png',
        price: 3.14,
      };
      const res = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newItem);

      expect(res.status).toBe(200);

      // The route returns the entire updated menu
      // So let's confirm the newly added item is present
      const menu = res.body;
      expect(Array.isArray(menu)).toBe(true);
      // find the item by title
      const found = menu.find((item) => item.title === newItem.title);
      expect(found).toBeTruthy();
      expect(found).toMatchObject({
        title: newItem.title,
        description: newItem.description,
        image: newItem.image,
        price: newItem.price,
      });
    });
  });

  //
  // ------------------------------------------------------------
  // 3. GET /api/order - get the user’s orders
  // ------------------------------------------------------------
  //
  describe('GET /api/order', () => {
    test('401 if no token', async () => {
      const res = await request(app).get('/api/order');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/unauthorized/i);
    });

    test('returns array of orders for diner (initially empty)', async () => {
      const res = await request(app)
        .get('/api/order')
        .set('Authorization', `Bearer ${dinerToken}`);

      expect(res.status).toBe(200);
      // The route returns { dinerId, orders: [...], page }
      expect(res.body).toHaveProperty('dinerId', dinerUser.id);
      expect(Array.isArray(res.body.orders)).toBe(true);
      expect(res.body.orders.length).toBe(0); // presumably empty initially
    });
  });

  //
  // ------------------------------------------------------------
  // 4. POST /api/order - create a new order
  // ------------------------------------------------------------
  //
  describe('POST /api/order', () => {
    test('401 if no token', async () => {
      const res = await request(app).post('/api/order').send({
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: 'Veggie', price: 0.05 }],
      });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/unauthorized/i);
    });

    test('creates an order for the diner (success)', async () => {
      // Let's assume your DB doesn't validate franchiseId/storeId existence
      // If it does, you might need a real franchiseId=1, storeId=1
      // or create them first.
      const newOrder = {
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: 'Veggie', price: 0.05 }],
      };

      const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${dinerToken}`)
        .send(newOrder);

      // If the pizza factory call fails, code might return 500.
      // If it succeeds, we expect 200. This depends on config.factory.url.
      // For test, let's just expect we get a 200 or 500, but not 401/403.
      expect([200, 500]).toContain(res.status);

      if (res.status === 200) {
        // Expect an object with { order, reportSlowPizzaToFactoryUrl, jwt }
        expect(res.body).toHaveProperty('order');
        expect(res.body.order).toHaveProperty('id');
        expect(res.body.order.items[0]).toMatchObject({
          description: 'Veggie',
          price: 0.05,
        });
        // The route also returns "reportSlowPizzaToFactoryUrl" and "jwt" if success
        // expect(res.body).toHaveProperty('reportSlowPizzaToFactoryUrl');
        expect(res.body).toHaveProperty('jwt');
      } else {
        // 500 means "Failed to fulfill order at factory"
        expect(res.body).toHaveProperty('message', 'Failed to fulfill order at factory');
        // Possibly also returns "reportPizzaCreationErrorToPizzaFactoryUrl"
        expect(res.body).toHaveProperty('reportPizzaCreationErrorToPizzaFactoryUrl');
      }
    });

    test('after creating an order, GET /api/order should now show 1 order for the diner', async () => {
      const res = await request(app)
        .get('/api/order')
        .set('Authorization', `Bearer ${dinerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dinerId', dinerUser.id);
      // If the previous call succeeded with a 200, we should have an order in DB
      // If the previous call was 500, the order might be partially or fully inserted.
      // We'll check if there's at least 1 order:
      expect(res.body.orders.length).toBeGreaterThanOrEqual(1);
    });
  });
});