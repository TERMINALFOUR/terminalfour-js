import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserResource } from '../src/resources/user-resource.js';
import { HttpClient } from '../src/http-client.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

describe('UserResource', () => {
  let http: HttpClient;
  let resource: UserResource;

  beforeEach(() => {
    http = mockHttpClient();
    resource = new UserResource(http);
  });

  it('list() returns all users with friendly userLevel', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      userList: [
        { id: 38, username: 'admin', firstName: 'Admin', lastName: 'Admin', authLevel: 0, emailAddress: 'a@b.com', enabled: true, accountLocked: false },
        { id: 61, username: 'editor', firstName: 'Ed', lastName: 'Itor', authLevel: 1, emailAddress: 'e@b.com', enabled: true, accountLocked: false },
      ],
    });

    const users = await resource.list();

    expect(users).toHaveLength(2);
    expect(users[0].userLevel).toBe('admin');
    expect(users[1].userLevel).toBe('moderator');
  });

  it('list() calls GET /userSearch with authLevel=100 for all users', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userList: [] });
    await resource.list();
    expect(http.request).toHaveBeenCalledWith({ method: 'GET', path: '/userSearch?authLevel=100&allUsers=true' });
  });

  it('list() filters by userLevel', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userList: [] });
    await resource.list({ userLevel: 'admin' });
    expect(http.request).toHaveBeenCalledWith({ method: 'GET', path: '/userSearch?authLevel=0&allUsers=true' });
  });

  it('list() throws for unknown userLevel', async () => {
    await expect(resource.list({ userLevel: 'superadmin' })).rejects.toThrow('Unknown user level');
  });

  it('get() returns a User with groups and friendly userLevel', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 30, username: 'j.smith', firstName: 'Jane', lastName: 'Smith',
      emailAddress: 'jane@example.com', userLevel: 0, defaultLanguage: 'en', enabled: true,
      groupUser: [{ id: 1, name: 'Sample Site', membersCount: 0 }],
    });

    const user = await resource.get(30);

    expect(user.id).toBe(30);
    expect(user.username).toBe('j.smith');
    expect(user.userLevel).toBe('admin');
    expect(user.defaultLanguage).toBe('en');
    expect(user.enabled).toBe(true);
    expect(user.groups).toEqual([{ id: 1, name: 'Sample Site' }]);
  });

  it('get() calls GET /user/{id}', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 30, username: 'test', firstName: 'T', lastName: 'U',
      emailAddress: 't@u.com', userLevel: 2, enabled: true, groupUser: [],
    });
    await resource.get(30);
    expect(http.request).toHaveBeenCalledWith({ method: 'GET', path: '/user/30' });
  });

  describe('authMethods', () => {
    it('get() parses authenticationMappingList into friendly authMethods', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 30, username: 'test', firstName: 'T', lastName: 'U',
        emailAddress: 't@u.com', userLevel: 0, enabled: true, groupUser: [],
        authenticationMappingList: [
          { id: 1, enabled: true },
          { id: 2, identifier: 'ldap-id', enabled: true },
          { id: 4, identifier: 'saml-id', enabled: true },
          { id: 5, identifier: 'cas-id', enabled: true },
          { id: 6, enabled: true },
        ],
      });

      const user = await resource.get(30);

      expect(user.authMethods.local).toBe(true);
      expect(user.authMethods.ldap).toEqual({ enabled: true, identifier: 'ldap-id' });
      expect(user.authMethods.saml).toEqual({ enabled: true, identifier: 'saml-id' });
      expect(user.authMethods.cas).toEqual({ enabled: true, identifier: 'cas-id' });
      expect(user.authMethods.remoteuser).toBe(true);
    });

    it('get() handles disabled auth methods', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 30, username: 'test', firstName: 'T', lastName: 'U',
        emailAddress: 't@u.com', userLevel: 0, enabled: true, groupUser: [],
        authenticationMappingList: [
          { id: 1, enabled: false },
          { id: 2, enabled: false },
        ],
      });

      const user = await resource.get(30);

      expect(user.authMethods.local).toBe(false);
      expect(user.authMethods.ldap).toBe(false);
    });

    it('get() returns empty authMethods when no authenticationMappingList', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 30, username: 'test', firstName: 'T', lastName: 'U',
        emailAddress: 't@u.com', userLevel: 0, enabled: true, groupUser: [],
      });

      const user = await resource.get(30);
      expect(user.authMethods).toEqual({});
    });

    it('save() syncs authMethods back to authenticationMappingList', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; body?: unknown }) => {
        if (opts.method === 'GET') return {
          id: 30, username: 'test', firstName: 'T', lastName: 'U',
          emailAddress: 't@u.com', userLevel: 0, enabled: true, groupUser: [],
          authenticationMappingList: [{ id: 1, enabled: true }],
        };
        if (opts.method === 'PUT') { putBody = opts.body; return undefined; }
        throw new Error('Unexpected');
      });

      const user = await resource.get(30);
      user.authMethods.ldap = { enabled: true, identifier: 'new-ldap-id' };
      await user.save();

      const body = putBody as { authenticationMappingList: Array<{ id: string; identifier?: string }> };
      expect(body.authenticationMappingList).toContainEqual({ id: '1' });
      expect(body.authenticationMappingList).toContainEqual({ id: '2', identifier: 'new-ldap-id' });
    });

    it('create() defaults to local auth when no authMethods provided', async () => {
      let postBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'POST' && opts.path === '/user') { postBody = opts.body; return { id: 0 }; }
        if (opts.path.startsWith('/userSearch')) return {
          userList: [{ id: 68, username: 'new.user', firstName: 'N', lastName: 'U', authLevel: 2, emailAddress: 'n@b.com', enabled: true, accountLocked: false }],
        };
        if (opts.method === 'GET' && opts.path === '/user/68') return {
          id: 68, username: 'new.user', firstName: 'N', lastName: 'U',
          emailAddress: 'n@b.com', userLevel: 2, enabled: true, groupUser: [],
        };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        username: 'new.user', firstName: 'N', lastName: 'U',
        emailAddress: 'n@b.com', password: 'pass123',
      });

      const body = postBody as { authenticationMappingList: Array<{ id: string }> };
      expect(body.authenticationMappingList).toEqual([{ id: '1' }]);
    });

    it('create() sends custom authMethods when provided', async () => {
      let postBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'POST' && opts.path === '/user') { postBody = opts.body; return { id: 0 }; }
        if (opts.path.startsWith('/userSearch')) return {
          userList: [{ id: 68, username: 'new.user', firstName: 'N', lastName: 'U', authLevel: 2, emailAddress: 'n@b.com', enabled: true, accountLocked: false }],
        };
        if (opts.method === 'GET' && opts.path === '/user/68') return {
          id: 68, username: 'new.user', firstName: 'N', lastName: 'U',
          emailAddress: 'n@b.com', userLevel: 2, enabled: true, groupUser: [],
        };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        username: 'new.user', firstName: 'N', lastName: 'U',
        emailAddress: 'n@b.com', password: 'pass123',
        authMethods: {
          local: true,
          ldap: { enabled: true, identifier: 'ldap-user' },
          saml: { enabled: true, identifier: 'saml-user' },
          remoteuser: true,
        },
      });

      const body = postBody as { authenticationMappingList: Array<{ id: string; identifier?: string }> };
      expect(body.authenticationMappingList).toContainEqual({ id: '1' });
      expect(body.authenticationMappingList).toContainEqual({ id: '2', identifier: 'ldap-user' });
      expect(body.authenticationMappingList).toContainEqual({ id: '4', identifier: 'saml-user' });
      expect(body.authenticationMappingList).toContainEqual({ id: '6' });
    });

    it('update() accepts authMethods in immutable pattern', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; body?: unknown }) => {
        if (opts.method === 'GET') return {
          id: 30, username: 'test', firstName: 'T', lastName: 'U',
          emailAddress: 't@u.com', userLevel: 0, enabled: true, groupUser: [],
          authenticationMappingList: [{ id: 1, enabled: true }],
        };
        if (opts.method === 'PUT') { putBody = opts.body; return undefined; }
        throw new Error('Unexpected');
      });

      await resource.update(30, {
        authMethods: { saml: { enabled: true, identifier: 'new-saml' } },
      });

      const body = putBody as { authenticationMappingList: Array<{ id: string; identifier?: string }> };
      expect(body.authenticationMappingList).toContainEqual({ id: '4', identifier: 'new-saml' });
    });
  });

  it('User.save() sends PUT with updated properties', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string }) => {
      if (opts.method === 'GET') return {
        id: 30, username: 'old', firstName: 'Old', lastName: 'Name',
        emailAddress: 'old@b.com', userLevel: 0, enabled: true, groupUser: [],
      };
      if (opts.method === 'PUT') return undefined;
      throw new Error('Unexpected');
    });

    const user = await resource.get(30);
    user.firstName = 'New';
    user.userLevel = 'moderator';
    await user.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    expect(putCall).toBeDefined();
    const body = putCall![0] as { body: Record<string, unknown> };
    expect(body.body.firstName).toBe('New');
    expect(body.body.userLevel).toBe('1');
    expect(body.body.password).toBe('');
  });

  it('update() immutably updates a user', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string }) => {
      if (opts.method === 'GET') return {
        id: 30, username: 'old', firstName: 'Old', lastName: 'Name',
        emailAddress: 'old@b.com', userLevel: 0, enabled: true, groupUser: [],
      };
      if (opts.method === 'PUT') return undefined;
      throw new Error('Unexpected');
    });

    const user = await resource.update(30, { firstName: 'Updated', enabled: false });
    expect(user.firstName).toBe('Updated');
    expect(user.enabled).toBe(false);
  });

  it('create() sends POST and returns a User with real ID', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.method === 'POST' && opts.path === '/user') return {
        id: 0, username: 'new.user', firstName: 'New', lastName: 'User',
        emailAddress: 'new@b.com', userLevel: 2, enabled: true,
      };
      if (opts.path.startsWith('/userSearch')) return {
        userList: [{ id: 68, username: 'new.user', firstName: 'New', lastName: 'User', authLevel: 2, emailAddress: 'new@b.com', enabled: true, accountLocked: false }],
      };
      if (opts.method === 'GET' && opts.path === '/user/68') return {
        id: 68, username: 'new.user', firstName: 'New', lastName: 'User',
        emailAddress: 'new@b.com', userLevel: 2, enabled: true, groupUser: [],
      };
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const user = await resource.create({
      username: 'new.user',
      firstName: 'New',
      lastName: 'User',
      emailAddress: 'new@b.com',
      password: 'pass123',
    });

    expect(user.id).toBe(68);
    expect(user.username).toBe('new.user');
    expect(user.userLevel).toBe('contributor');
  });

  it('create() throws if username is empty', async () => {
    await expect(resource.create({ username: '', firstName: 'A', lastName: 'B', emailAddress: 'a@b.com', password: 'x' }))
      .rejects.toThrow('Username is required');
  });

  it('create() throws if password is empty', async () => {
    await expect(resource.create({ username: 'test', firstName: 'A', lastName: 'B', emailAddress: 'a@b.com', password: '' }))
      .rejects.toThrow('Password is required');
  });

  describe('lastLogin', () => {
    it('list() returns lastLogin as Date when lastLoginDate is present', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        userList: [
          { id: 38, username: 'admin', firstName: 'Admin', lastName: 'Admin', authLevel: 0, emailAddress: 'a@b.com', enabled: true, accountLocked: false, lastLoginDate: 1780499336000 },
        ],
      });

      const users = await resource.list();
      expect(users[0].lastLogin).toEqual(new Date(1780499336000));
    });

    it('list() returns lastLogin as null when lastLoginDate is absent', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        userList: [
          { id: 47, username: 'newguy', firstName: 'New', lastName: 'Guy', authLevel: 2, emailAddress: 'n@b.com', enabled: true, accountLocked: false },
        ],
      });

      const users = await resource.list();
      expect(users[0].lastLogin).toBeNull();
    });

    it('get() returns lastLogin as Date when lastLoginDate is present', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 38, username: 'admin', firstName: 'Admin', lastName: 'Admin',
        emailAddress: 'a@b.com', userLevel: 0, enabled: true, groupUser: [],
        lastLoginDate: 1584027669000,
      });

      const user = await resource.get(38);
      expect(user.lastLogin).toEqual(new Date(1584027669000));
    });

    it('get() returns lastLogin as null when lastLoginDate is absent', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 47, username: 'newguy', firstName: 'New', lastName: 'Guy',
        emailAddress: 'n@b.com', userLevel: 2, enabled: true, groupUser: [],
      });

      const user = await resource.get(47);
      expect(user.lastLogin).toBeNull();
    });
  });
});
