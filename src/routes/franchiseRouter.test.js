/**
 * FranchiseRouter.test.js
 *
 * Tests CRUD operations on franchises and stores, including role-based 
 * access (global admin vs. diner vs. franchise admin).
 */

const request = require('supertest');
const app = require('../service');
const { DB, Role } = require('../database/database.js');

/**
 * Optional utility: generate a random name for your test objects
 */
function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

/**
 * Logs in with default admin credentials (the DB usually seeds a user 
 *   with email: 'a@jwt.com', password: 'admin' and role: Role.Admin), 
 * OR create a brand-new admin if you prefer to do so dynamically.
 */
async function loginDefaultAdmin() {
  const res = await request(app)
    .put('/api/auth')
    .send({
      email: 'a@jwt.com',
      password: 'admin',
    });
  if (res.status !== 200) {
    throw new Error(
      `Default admin login failed with status ${res.status}: ${res.text}`
    );
  }
  return { token: res.body.token, user: res.body.user };
}

/**
 * Create a normal diner user via the /api/auth register route.
 */
async function registerDinerUser() {
  const userData = {
    name: randomName(),
    email: `${randomName()}@test.com`,
    password: 'test1234',
  };
  const res = await request(app).post('/api/auth').send(userData);
  if (res.status !== 200) {
    throw new Error(`registerDinerUser failed: ${res.status} => ${res.text}`);
  }
  return {
    user: res.body.user,
    token: res.body.token,
    rawCredentials: { ...userData }, // keep track of email/password
  };
}

/**
 * Login a user, returning { token, user } 
 */
async function loginUser(email, password) {
  const res = await request(app)
    .put('/api/auth')
    .send({ email, password });
  return { status: res.status, body: res.body };
}

describe('Franchise Router', () => {
  let adminToken;
  let adminUserId;

  let dinerUser;       // normal user object
  let dinerToken;      // normal user's token
  let dinerUserId;

  let createdFranchise;     // store the newly created franchise
  let createdStore;         // store the newly created store

  //
  // -----------------------------------------------------
  // 1. Setup: Login as admin and register a diner
  // -----------------------------------------------------
  //
  beforeAll(async () => {
    // 1) Login the default admin
    const adminLogin = await loginDefaultAdmin();
    adminToken = adminLogin.token;
    adminUserId = adminLogin.user.id;

    // 2) Create a normal diner user
    const newDiner = await registerDinerUser();
    dinerUser = newDiner.user;
    dinerToken = newDiner.token;
    dinerUserId = dinerUser.id;
  });

  //
  // -----------------------------------------------------
  // 2. GET /api/franchise 
  // -----------------------------------------------------
  // By default, should return all franchises. If user is admin, we might see 
  // more details. If user is not logged in, user is null => partial info.
  //
  describe('GET /api/franchise', () => {
    test('returns franchise list (no auth)', async () => {
      // No Authorization header => req.user = null
      const res = await request(app).get('/api/franchise');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      // Possibly check if the returned objects have limited data 
      // if your code differentiates admin vs. no user. 
      // For now, we just expect an array.
    });

    test('returns franchise list (admin user)', async () => {
      const res = await request(app)
        .get('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // If admin sees more details, you can test that 
      // e.g. expect(res.body[0]).toHaveProperty('admins')
    });
  });

  //
  // -----------------------------------------------------
  // 3. GET /api/franchise/:userId - List user franchises
  // -----------------------------------------------------
  // Requires auth. Only that user or an admin can view.
  //
  describe('GET /api/franchise/:userId', () => {
    test('401 if no token', async () => {
      const res = await request(app).get(`/api/franchise/${dinerUserId}`);
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message', 'unauthorized');
    });

    test('200 if same user', async () => {
      const res = await request(app)
        .get(`/api/franchise/${dinerUserId}`)
        .set('Authorization', `Bearer ${dinerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Probably empty array since user might not be admin for any franchises yet
    });

    test('200 if admin user', async () => {
      const res = await request(app)
        .get(`/api/franchise/${dinerUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('403 or empty result if some other diner tries to view another diner’s franchises', async () => {
      // For now, your code allows only "if (req.user.id === userId || req.user.isRole(Role.Admin))".
      // That means it won't return data for a different user who isn't admin => returns empty array or 200?
      // Actually the code shows "result = await DB.getUserFranchises(userId);" only if user is that user or admin.
      // If not, it does "res.json([])" effectively. There's no direct 403 thrown. 
      // Let's confirm that it returns 200 with an empty array or so.
      const newDiner = await registerDinerUser();
      const otherDinerRes = await request(app)
        .get(`/api/franchise/${dinerUserId}`)
        .set('Authorization', `Bearer ${newDiner.token}`);

      // The code sets result=[] if not the same user or admin. 
      // So let's expect a 200 with an empty array
      expect(otherDinerRes.status).toBe(200);
      expect(Array.isArray(otherDinerRes.body)).toBe(true);
      expect(otherDinerRes.body.length).toBe(0);
    });
  });

  //
  // -----------------------------------------------------
  // 4. POST /api/franchise - Create a new franchise
  // -----------------------------------------------------
  // Only an admin can create a franchise, passing an object that 
  // includes "name" and "admins" array with emails
  //
  describe('POST /api/franchise', () => {
    const franchiseData = {
      name: 'PizzaPocket' + randomName(),
      admins: [{ email: '' }], // We'll fill in our diner user's email
    };

    test('403 if user is not admin', async () => {
      franchiseData.admins[0].email = dinerUser.email; // doesn't matter, user is not admin
      const res = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${dinerToken}`)
        .send(franchiseData);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message', 'unable to create a franchise');
    });

    test('201 or 200 if user is admin (success)', async () => {
      // Let’s have admin create a franchise, specifying the diner as an additional admin
      franchiseData.admins[0].email = dinerUser.email;
      const res = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(franchiseData);

      // Your code calls:  res.send(await DB.createFranchise(franchise))
      // Usually that means status = 200 (unless you specifically set 201).
      expect([200, 201]).toContain(res.status);

      // The new franchise record
      // e.g. { id: 2, name: 'PizzaPocketXXX', admins: [...], stores: [...] }
      createdFranchise = res.body;
      expect(createdFranchise).toHaveProperty('id');
      expect(createdFranchise).toHaveProperty('name', franchiseData.name);

      // The code also adds the users in franchiseData.admins as "franchisee"
      // So we expect to see the diner user in the returned "admins"
      const dinerInAdmins = createdFranchise.admins.find(ad => ad.email === dinerUser.email);
      expect(dinerInAdmins).toBeTruthy();
    });
  });

  //
  // -----------------------------------------------------
  // 5. POST /api/franchise/:franchiseId/store - Create store
  // -----------------------------------------------------
  // Requires user to be admin of the entire system or admin of that franchise. 
  //
  describe('POST /api/franchise/:franchiseId/store', () => {
    test('403 if user is diner not in admins for that franchise', async () => {
      // We'll create a brand-new diner that isn't in the newly created franchise's admin list
      const otherDiner = await registerDinerUser();

      const res = await request(app)
        .post(`/api/franchise/${createdFranchise.id}/store`)
        .set('Authorization', `Bearer ${otherDiner.token}`)
        .send({ name: 'SLC Store' });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message', 'unable to create a store');
    });

    test('success if user is global admin', async () => {
      const res = await request(app)
        .post(`/api/franchise/${createdFranchise.id}/store`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Admin Store' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name', 'Admin Store');
      createdStore = res.body; // store for later delete test
    });

    test('success if user is a franchise admin for that franchise', async () => {
      // Our dinerUser was specified as an admin for the createdFranchise,
      // so they should be able to add a new store
      const res = await request(app)
        .post(`/api/franchise/${createdFranchise.id}/store`)
        .set('Authorization', `Bearer ${dinerToken}`)
        .send({ name: 'Diner-Admin Store' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name', 'Diner-Admin Store');
    });
  });

  //
  // -----------------------------------------------------
  // 6. DELETE /api/franchise/:franchiseId/store/:storeId - Delete a store
  // -----------------------------------------------------
  // Must be an admin of that franchise or a global admin
  //
  describe('DELETE /api/franchise/:franchiseId/store/:storeId', () => {
    test('403 if not a relevant admin', async () => {
      // Another random diner
      const otherDiner = await registerDinerUser();

      const res = await request(app)
        .delete(`/api/franchise/${createdFranchise.id}/store/${createdStore.id}`)
        .set('Authorization', `Bearer ${otherDiner.token}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message', 'unable to delete a store');
    });

    test('success if global admin', async () => {
      const newStoreRes = await request(app)
        .post(`/api/franchise/${createdFranchise.id}/store`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'StoreToDelete' });
      const storeToDelete = newStoreRes.body;

      const res = await request(app)
        .delete(`/api/franchise/${createdFranchise.id}/store/${storeToDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'store deleted');
    });
  });

  //
  // -----------------------------------------------------
  // 7. DELETE /api/franchise/:franchiseId - Delete a franchise
  // -----------------------------------------------------
  // Only global admin can do that in your code (not franchise admin).
  //
  describe('DELETE /api/franchise/:franchiseId', () => {
    test('403 if not global admin', async () => {
      const res = await request(app)
        .delete(`/api/franchise/${createdFranchise.id}`)
        .set('Authorization', `Bearer ${dinerToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message', 'unable to delete a franchise');
    });

    test('success if user is global admin', async () => {
      const res = await request(app)
        .delete(`/api/franchise/${createdFranchise.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'franchise deleted');
    });
  });
});