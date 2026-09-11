import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface CustomerResponse {
  id: string;
  email: string;
  name: string;
}

interface LoginResponse {
  accessToken: string;
}

interface MenuItemResponse {
  id: string;
  name: string;
  description: string;
  price: string | number;
  available: boolean;
}

interface OrderItemResponse {
  menuItemId: string;
  quantity: number;
  unitPrice: string | number;
}

interface OrderResponse {
  id: string;
  customerId: string;
  status: string;
  total: string | number;
  items: OrderItemResponse[];
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
      }),
    );
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer()).get('/api/health').expect(200).expect({
      status: 'ok',
      database: 'ok',
    });
  });

  it('/api/menu (POST) - creates a menu item', async () => {
    const name = 'Test Burger';

    const response = await request(app.getHttpServer())
      .post('/api/menu')
      .send({
        name,
        description: 'A burger created by an E2E test',
        price: 12.99,
      })
      .expect(201);

    const menuItem = response.body as MenuItemResponse;

    expect(menuItem).toMatchObject({
      name,
      description: 'A burger created by an E2E test',
    });

    expect(menuItem.id).toEqual(expect.any(String));
    expect(Number(menuItem.price)).toBe(12.99);
  });

  it('/api/menu (POST) - rejects a negative price', () => {
    return request(app.getHttpServer())
      .post('/api/menu')
      .send({
        name: 'Invalid Burger',
        description: 'This should not be created',
        price: -5,
      })
      .expect(400);
  });

  it('/api/menu (POST) - rejects a duplicate name', async () => {
    const name = 'Duplicate Burger';

    await request(app.getHttpServer())
      .post('/api/menu')
      .send({
        name,
        description: 'First item',
        price: 10,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/menu')
      .send({
        name,
        description: 'Second item',
        price: 15,
      })
      .expect(409);
  });

  it('/api/menu (GET) - returns menu items', async () => {
    const name = 'Menu Test Item';

    await request(app.getHttpServer())
      .post('/api/menu')
      .send({
        name,
        description: 'Item for GET test',
        price: 9.99,
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/menu')
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name,
          description: 'Item for GET test',
        }),
      ]),
    );
  });

  it('/api/menu/:id (GET) - returns a menu item', async () => {
    const name = 'Single Item';

    const createResponse = await request(app.getHttpServer())
      .post('/api/menu')
      .send({
        name,
        description: 'Item for single-item GET test',
        price: 14.99,
      })
      .expect(201);

    const createdMenuItem = createResponse.body as MenuItemResponse;
    const id = createdMenuItem.id;

    const response = await request(app.getHttpServer())
      .get(`/api/menu/${id}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id,
      name,
      description: 'Item for single-item GET test',
    });
  });

  it('/api/menu/:id (GET) - returns 404 for a nonexistent item', () => {
    const id = '00000000-0000-0000-0000-000000000000';

    return request(app.getHttpServer())
      .get(`/api/menu/${id}`)
      .expect(404)
      .expect({
        statusCode: 404,
        message: 'Menu item not found',
        error: 'Not Found',
      });
  });

  it('/api/menu/:id (PATCH) - updates a menu item', async () => {
    const name = 'Update Test';

    const createResponse = await request(app.getHttpServer())
      .post('/api/menu')
      .send({
        name,
        description: 'Original description',
        price: 10,
      })
      .expect(201);

    const createdMenuItem = createResponse.body as MenuItemResponse;
    const id = createdMenuItem.id;

    const response = await request(app.getHttpServer())
      .patch(`/api/menu/${id}`)
      .send({
        description: 'Updated description',
        price: 12.5,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id,
      name,
      description: 'Updated description',
    });
  });

  it('/api/menu/:id (PATCH) - returns 404 for a nonexistent item', () => {
    const id = '00000000-0000-0000-0000-000000000000';

    return request(app.getHttpServer())
      .patch(`/api/menu/${id}`)
      .send({
        price: 20,
      })
      .expect(404)
      .expect({
        statusCode: 404,
        message: 'Menu item not found',
        error: 'Not Found',
      });
  });

  it('/api/menu/:id (DELETE) - soft deletes a menu item', async () => {
    const name = 'Delete Test';

    const createResponse = await request(app.getHttpServer())
      .post('/api/menu')
      .send({
        name,
        description: 'Item to be deleted',
        price: 8.99,
      })
      .expect(201);

    const createdMenuItem = createResponse.body as MenuItemResponse;
    const id = createdMenuItem.id;

    await request(app.getHttpServer()).delete(`/api/menu/${id}`).expect(200);

    await request(app.getHttpServer()).get(`/api/menu/${id}`).expect(404);
  });

  it('/api/menu/:id (DELETE) - returns 404 for a nonexistent item', () => {
    const id = '00000000-0000-0000-0000-000000000000';

    return request(app.getHttpServer())
      .delete(`/api/menu/${id}`)
      .expect(404)
      .expect({
        statusCode: 404,
        message: 'Menu item not found',
        error: 'Not Found',
      });
  });

  it('should create an order for an authenticated customer', async () => {
    const email = 'e2e@example.com';
    const password = 'password123';

    // 1. Create a customer
    const customerResponse = await request(app.getHttpServer())
      .post('/api/customers')
      .send({
        email,
        name: 'E2E Customer',
        password,
      })
      .expect(201);

    const customer = customerResponse.body as CustomerResponse;

    expect(customer).toMatchObject({
      email,
      name: 'E2E Customer',
    });

    // 2. Log in and get a JWT
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email,
        password,
      })
      .expect(201);

    const login = loginResponse.body as LoginResponse;
    const accessToken = login.accessToken;

    expect(accessToken).toEqual(expect.any(String));

    // 3. Create a menu item
    const menuItemResponse = await request(app.getHttpServer())
      .post('/api/menu')
      .send({
        name: 'E2E Burger',
        description: 'E2E test burger',
        price: 12.5,
      })
      .expect(201);

    const menuItem = menuItemResponse.body as MenuItemResponse;
    const menuItemId = menuItem.id;

    expect(menuItemId).toEqual(expect.any(String));

    // 4. Create an order using the authenticated customer
    const orderResponse = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        items: [
          {
            menuItemId,
            quantity: 2,
          },
        ],
      })
      .expect(201);

    const order = orderResponse.body as OrderResponse;

    // 5. Verify the order
    expect(order).toMatchObject({
      customerId: customer.id,
      status: 'PENDING',
    });

    expect(order.items).toHaveLength(1);

    expect(order.items[0]).toMatchObject({
      menuItemId,
      quantity: 2,
    });

    expect(Number(order.items[0].unitPrice)).toBe(12.5);
    expect(Number(order.total)).toBe(25);
  });

  it('should reject unauthenticated order creation', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({
        items: [],
      })
      .expect(401);
  });

  it('should reject an order with a nonexistent menu item', async () => {
    const email = 'e2e_nonexistent@example.com';
    const password = 'password123';

    await request(app.getHttpServer())
      .post('/api/customers')
      .send({
        email,
        name: 'E2E Customer',
        password,
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email,
        password,
      })
      .expect(201);

    const login = loginResponse.body as LoginResponse;
    const accessToken = login.accessToken;

    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        items: [
          {
            menuItemId: '00000000-0000-0000-0000-000000000000',
            quantity: 1,
          },
        ],
      })
      .expect(404);
  });

  it('should reject an order with an unavailable menu item', async () => {
    const email = 'e2e_unavailable@example.com';
    const password = 'password123';

    await request(app.getHttpServer())
      .post('/api/customers')
      .send({
        email,
        name: 'E2E Customer',
        password,
      })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email,
        password,
      })
      .expect(201);

    const login = loginResponse.body as LoginResponse;
    const accessToken = login.accessToken;

    const menuItemResponse = await request(app.getHttpServer())
      .post('/api/menu')
      .send({
        name: 'E2E Unavailable Item',
        description: 'Should not be orderable',
        price: 10,
      })
      .expect(201);

    const menuItem = menuItemResponse.body as MenuItemResponse;
    const menuItemId = menuItem.id;

    await request(app.getHttpServer())
      .patch(`/api/menu/${menuItemId}`)
      .send({
        available: false,
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        items: [
          {
            menuItemId,
            quantity: 1,
          },
        ],
      })
      .expect(400);
  });

  it('should reject a customer from accessing another customer order', async () => {
    const customerA = {
      email: 'e2e-a@example.com',
      name: 'E2E Customer A',
      password: 'password123',
    };

    const customerB = {
      email: 'e2e-b@example.com',
      name: 'E2E Customer B',
      password: 'password123',
    };

    // Create Customer A
    await request(app.getHttpServer())
      .post('/api/customers')
      .send(customerA)
      .expect(201);

    // Create Customer B
    await request(app.getHttpServer())
      .post('/api/customers')
      .send(customerB)
      .expect(201);

    // Log in as Customer A
    const loginAResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: customerA.email,
        password: customerA.password,
      })
      .expect(201);

    const loginA = loginAResponse.body as LoginResponse;
    const accessTokenA = loginA.accessToken;

    // Create a menu item
    const menuItemResponse = await request(app.getHttpServer())
      .post('/api/menu')
      .send({
        name: 'E2E Ownership Burger',
        description: 'Ownership test',
        price: 15,
      })
      .expect(201);

    const menuItem = menuItemResponse.body as MenuItemResponse;
    const menuItemId = menuItem.id;

    // Create an order belonging to Customer A
    const orderResponse = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${accessTokenA}`)
      .send({
        items: [
          {
            menuItemId,
            quantity: 1,
          },
        ],
      })
      .expect(201);

    const order = orderResponse.body as OrderResponse;

    // Log in as Customer B
    const loginBResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: customerB.email,
        password: customerB.password,
      })
      .expect(201);

    const loginB = loginBResponse.body as LoginResponse;
    const accessTokenB = loginB.accessToken;

    // Customer B attempts to access Customer A's order
    await request(app.getHttpServer())
      .get(`/api/orders/customers/me/orders/${order.id}`)
      .set('Authorization', `Bearer ${accessTokenB}`)
      .expect(403);
  });

  it('should reject a customer from updating order status', async () => {
    const customer = {
      email: 'e2e-staff@example.com',
      name: 'E2E Customer',
      password: 'password123',
    };

    // Create customer
    await request(app.getHttpServer())
      .post('/api/customers')
      .send(customer)
      .expect(201);

    // Log in as customer
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: customer.email,
        password: customer.password,
      })
      .expect(201);

    const login = loginResponse.body as LoginResponse;
    const accessToken = login.accessToken;

    // Create menu item
    const menuItemResponse = await request(app.getHttpServer())
      .post('/api/menu')
      .send({
        name: 'E2E Staff Burger',
        description: 'Staff authorization test',
        price: 15,
      })
      .expect(201);

    const menuItem = menuItemResponse.body as MenuItemResponse;
    const menuItemId = menuItem.id;

    // Create order as the customer
    const orderResponse = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        items: [
          {
            menuItemId,
            quantity: 1,
          },
        ],
      })
      .expect(201);

    const order = orderResponse.body as OrderResponse;

    // Customer attempts to change the order status
    await request(app.getHttpServer())
      .patch(`/api/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'CONFIRMED',
      })
      .expect(403);

    // Verify the order is still PENDING
    const orderCheck = await request(app.getHttpServer())
      .get(`/api/orders/${order.id}`)
      .expect(200);

    const orderCheckBody = orderCheck.body as OrderResponse;

    expect(orderCheckBody.status).toBe('PENDING');
  });

  afterEach(async () => {
    await app.close();
  });
});
