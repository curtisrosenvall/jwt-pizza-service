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


function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

/**
 * Directly create an Admin user in the DB, then log them in.
 * Returns { user, token }
 */
async function createAndLoginAdmin() {
  
  const adminData = {
    name: 'Test Admin ' + randomName(),
    email: randomName() + '@admin.com',
    password: 'secretAdmin',
    roles: [{ role: Role.Admin }],
  };
  const newAdmin = await DB.addUser(adminData);

  
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
  
  const registerRes = await request(app).post('/api/auth').send(userData);
  if (registerRes.status !== 200) {
    throw new Error(
      `Diner registration failed: ${registerRes.status} => ${registerRes.text}`
    );
  }
  
  return { user: registerRes.body.user, token: registerRes.body.token };
}


jest.setTimeout(30000);

describe('Order Router', () => {
  let adminToken;
  
  let adminUser;
  let dinerToken;
  let dinerUser;

  beforeAll(async () => {
    
    const admin = await createAndLoginAdmin();
    adminToken = admin.token;
    adminUser = admin.user;

    
    const diner = await createAndLoginDiner();
    dinerToken = diner.token;
    dinerUser = diner.user;
  });

  
  
  
  
  
  describe('GET /api/order/menu', () => {
    test('should return an array of menu items (no auth needed)', async () => {
      const res = await request(app).get('/api/order/menu');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      
      
    });
  });

  
  
  
  
  
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

      
      
      const menu = res.body;
      expect(Array.isArray(menu)).toBe(true);
      
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
      
      expect(res.body).toHaveProperty('dinerId', dinerUser.id);
      expect(Array.isArray(res.body.orders)).toBe(true);
      expect(res.body.orders.length).toBe(0); 
    });
  });

  
  
  
  
  
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
      
      
      
      const newOrder = {
        franchiseId: 1,
        storeId: 1,
        items: [{ menuId: 1, description: 'Veggie', price: 0.05 }],
      };

      const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${dinerToken}`)
        .send(newOrder);

      
      
      
      expect([200, 500]).toContain(res.status);

      if (res.status === 200) {
        
        expect(res.body).toHaveProperty('order');
        expect(res.body.order).toHaveProperty('id');
        expect(res.body.order.items[0]).toMatchObject({
          description: 'Veggie',
          price: 0.05,
        });
        
        
        expect(res.body).toHaveProperty('jwt');
      } else {
        
        expect(res.body).toHaveProperty('message', 'Failed to fulfill order at factory');
        
        expect(res.body).toHaveProperty('reportPizzaCreationErrorToPizzaFactoryUrl');
      }
    });

    test('after creating an order, GET /api/order should now show 1 order for the diner', async () => {
      const res = await request(app)
        .get('/api/order')
        .set('Authorization', `Bearer ${dinerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dinerId', dinerUser.id);
      
      
      
      expect(res.body.orders.length).toBeGreaterThanOrEqual(1);
    });
  });
});