import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupResource } from '../src/resources/group-resource.js';
import { HttpClient } from '../src/http-client.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

describe('GroupResource', () => {
  let http: HttpClient;
  let resource: GroupResource;

  beforeEach(() => {
    http = mockHttpClient();
    resource = new GroupResource(http);
  });

  it('list() returns flat groups with children and parentIds', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      groupAllowed: [
        { id: 1, name: 'Parent', description: 'Top group', membersCount: 3, enabled: true, ldap: false, children: [2], groupChildren: [] },
        { id: 2, name: 'Child', description: '', membersCount: 1, enabled: true, ldap: false, children: [], groupChildren: [] },
      ],
    });

    const groups = await resource.list();

    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({
      id: 1, name: 'Parent', description: 'Top group', membersCount: 3, enabled: true, children: [2], parentIds: [],
    });
    expect(groups[1]).toEqual({
      id: 2, name: 'Child', description: '', membersCount: 1, enabled: true, children: [], parentIds: [1],
    });
  });

  it('list() deduplicates groups by ID', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      groupAllowed: [
        { id: 1, name: 'Parent', description: '', membersCount: 1, enabled: true, ldap: false, children: [2], groupChildren: [] },
        { id: 2, name: 'Child', description: '', membersCount: 1, enabled: true, ldap: false, children: [], groupChildren: [] },
        { id: 2, name: 'Child', description: '', membersCount: 1, enabled: true, ldap: false, children: [], groupChildren: [] },
      ],
    });

    const groups = await resource.list();
    expect(groups).toHaveLength(2);
  });

  it('list() handles multiple parents', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      groupAllowed: [
        { id: 1, name: 'A', description: '', membersCount: 1, enabled: true, ldap: false, children: [3], groupChildren: [] },
        { id: 2, name: 'B', description: '', membersCount: 1, enabled: true, ldap: false, children: [3], groupChildren: [] },
        { id: 3, name: 'Shared Child', description: '', membersCount: 1, enabled: true, ldap: false, children: [], groupChildren: [] },
      ],
    });

    const groups = await resource.list();
    const child = groups.find(g => g.id === 3);
    expect(child?.parentIds).toEqual([1, 2]);
  });

  it('list() calls GET /groupSearch', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ groupAllowed: [] });
    await resource.list();
    expect(http.request).toHaveBeenCalledWith({ method: 'GET', path: '/groupSearch' });
  });

  it('get() returns a Group with members', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 1, name: 'Sample Site', description: 'Default group', membersCount: 2, enabled: true, ldap: false,
      emailAddress: 'group@example.com', children: [], groupChildren: [],
      members: [
        { id: 30, username: 'admin', firstName: 'Admin', lastName: 'User', authLevel: 0, emailAddress: 'admin@example.com' },
        { id: 66, username: 'editor', firstName: 'Editor', lastName: 'Person', authLevel: 2, emailAddress: 'editor@example.com' },
      ],
    });

    const group = await resource.get(1);

    expect(group.id).toBe(1);
    expect(group.name).toBe('Sample Site');
    expect(group.description).toBe('Default group');
    expect(group.enabled).toBe(true);
    expect(group.emailAddress).toBe('group@example.com');
    expect(group.members).toHaveLength(2);
    expect(group.members[0]).toEqual({
      id: 30, username: 'admin', firstName: 'Admin', lastName: 'User', emailAddress: 'admin@example.com', userLevel: 'admin',
    });
    expect(group.members[1].userLevel).toBe('contributor');
  });

  it('get() calls GET /group/{id}', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 1, name: 'Test', membersCount: 0, enabled: true, ldap: false, children: [], groupChildren: [], members: [],
    });
    await resource.get(1);
    expect(http.request).toHaveBeenCalledWith({ method: 'GET', path: '/group/1' });
  });

  it('Group.save() sends PUT with updated properties', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string }) => {
      if (opts.method === 'GET') return {
        id: 1, name: 'Old', description: '', membersCount: 1, enabled: true, ldap: false,
        children: [], groupChildren: [], defaultPreviewChannel: 0,
        members: [{ id: 30, username: 'admin', firstName: 'A', lastName: 'B', authLevel: 0, emailAddress: 'a@b.com' }],
      };
      if (opts.method === 'PUT') return undefined;
      throw new Error('Unexpected');
    });

    const group = await resource.get(1);
    group.name = 'Renamed';
    group.description = 'Updated';
    await group.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    expect(putCall).toBeDefined();
    const body = putCall![0] as { body: Record<string, unknown> };
    expect(body.body.name).toBe('Renamed');
    expect(body.body.description).toBe('Updated');
  });

  it('Group.addMember() resolves user and includes in save', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.method === 'GET' && opts.path === '/group/1') return {
        id: 1, name: 'Test', membersCount: 1, enabled: true, ldap: false,
        children: [], groupChildren: [], defaultPreviewChannel: 0,
        members: [{ id: 30, username: 'admin', firstName: 'Admin', lastName: 'User', authLevel: 0, emailAddress: 'a@b.com' }],
      };
      if (opts.method === 'GET' && opts.path === '/user/61') return {
        id: 61, username: 'editor', firstName: 'Editor', lastName: 'Person', authLevel: 1, emailAddress: 'e@b.com',
      };
      if (opts.method === 'PUT') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const group = await resource.get(1);
    group.addMembers([61]);
    await group.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const members = (putCall![0] as { body: { members: Array<{ id: number }> } }).body.members;
    expect(members).toHaveLength(2);
    expect(members.map((m: { id: number }) => m.id)).toContain(61);
  });

  it('Group.addMembers() updates the public members array after save', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.method === 'GET' && opts.path === '/group/1') return {
        id: 1, name: 'Test', membersCount: 1, enabled: true, ldap: false,
        children: [], groupChildren: [], defaultPreviewChannel: 0,
        members: [{ id: 30, username: 'admin', firstName: 'Admin', lastName: 'User', authLevel: 0, emailAddress: 'a@b.com' }],
      };
      if (opts.method === 'GET' && opts.path === '/user/61') return {
        id: 61, username: 'editor', firstName: 'Editor', lastName: 'Person', authLevel: 2, emailAddress: 'e@b.com',
      };
      if (opts.method === 'PUT') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const group = await resource.get(1);
    expect(group.members).toHaveLength(1);

    group.addMembers([61]);
    await group.save();

    expect(group.members).toHaveLength(2);
    expect(group.members.find(m => m.id === 61)).toBeDefined();
    expect(group.members.find(m => m.id === 61)!.username).toBe('editor');
    expect(group.members.find(m => m.id === 61)!.userLevel).toBe('contributor');
  });

  it('Group.removeMembers() updates the public members array after save', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string }) => {
      if (opts.method === 'GET') return {
        id: 1, name: 'Test', membersCount: 2, enabled: true, ldap: false,
        children: [], groupChildren: [], defaultPreviewChannel: 0,
        members: [
          { id: 30, username: 'admin', firstName: 'A', lastName: 'B', authLevel: 0, emailAddress: 'a@b.com' },
          { id: 66, username: 'editor', firstName: 'C', lastName: 'D', authLevel: 2, emailAddress: 'c@d.com' },
        ],
      };
      if (opts.method === 'PUT') return undefined;
      throw new Error('Unexpected');
    });

    const group = await resource.get(1);
    expect(group.members).toHaveLength(2);

    group.removeMembers([66]);
    await group.save();

    expect(group.members).toHaveLength(1);
    expect(group.members[0].id).toBe(30);
  });

  it('Group.removeMember() excludes member from save', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string }) => {
      if (opts.method === 'GET') return {
        id: 1, name: 'Test', membersCount: 2, enabled: true, ldap: false,
        children: [], groupChildren: [], defaultPreviewChannel: 0,
        members: [
          { id: 30, username: 'admin', firstName: 'A', lastName: 'B', authLevel: 0, emailAddress: 'a@b.com' },
          { id: 66, username: 'editor', firstName: 'C', lastName: 'D', authLevel: 2, emailAddress: 'c@d.com' },
        ],
      };
      if (opts.method === 'PUT') return undefined;
      throw new Error('Unexpected');
    });

    const group = await resource.get(1);
    group.removeMembers([66]);
    await group.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const members = (putCall![0] as { body: { members: Array<{ id: number }> } }).body.members;
    expect(members).toHaveLength(1);
    expect(members[0].id).toBe(30);
  });

  it('update() immutably updates a group', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string }) => {
      if (opts.method === 'GET') return {
        id: 1, name: 'Old', description: '', membersCount: 1, enabled: true, ldap: false,
        children: [], groupChildren: [], defaultPreviewChannel: 0,
        members: [{ id: 30, username: 'admin', firstName: 'A', lastName: 'B', authLevel: 0, emailAddress: 'a@b.com' }],
      };
      if (opts.method === 'PUT') return undefined;
      throw new Error('Unexpected');
    });

    const group = await resource.update(1, { name: 'Updated', enabled: false });
    expect(group.name).toBe('Updated');
    expect(group.enabled).toBe(false);
  });

  it('create() resolves member IDs and sends POST', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/user/38') return {
        id: 38, username: 'admin', firstName: 'Admin', lastName: 'Admin', authLevel: 0, emailAddress: 'a@b.com',
      };
      if (opts.method === 'POST' && opts.path === '/group') return {
        id: 42, name: 'New Group', description: 'Desc', membersCount: 1, enabled: true, ldap: false,
        children: [], groupChildren: [], emailAddress: 'g@b.com',
        members: [{ id: 38, username: 'admin', firstName: 'Admin', lastName: 'Admin', authLevel: 0, emailAddress: 'a@b.com' }],
      };
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const group = await resource.create({
      name: 'New Group',
      description: 'Desc',
      emailAddress: 'g@b.com',
      members: [38],
    });

    expect(group.id).toBe(42);
    expect(group.name).toBe('New Group');
    expect(group.members).toHaveLength(1);
  });

  it('create() throws if no members', async () => {
    await expect(resource.create({ name: 'Test', members: [] })).rejects.toThrow('at least one member');
  });

  it('create() throws if no name', async () => {
    await expect(resource.create({ name: '', members: [1] })).rejects.toThrow('name is required');
  });

  it('Group.save() throws if all members removed', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 1, name: 'Test', membersCount: 1, enabled: true, ldap: false,
      children: [], groupChildren: [], defaultPreviewChannel: 0,
      members: [{ id: 30, username: 'admin', firstName: 'A', lastName: 'B', authLevel: 0, emailAddress: 'a@b.com' }],
    });

    const group = await resource.get(1);
    group.removeMembers([30]);
    await expect(group.save()).rejects.toThrow('at least one member');
  });

  it('delete() sends DELETE /group/{id}', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await resource.delete(42);
    expect(http.request).toHaveBeenCalledWith({ method: 'DELETE', path: '/group/42' });
  });
});
