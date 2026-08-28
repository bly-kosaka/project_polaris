import { describe, expect, it } from 'vitest';
import { BUILT_IN_KNOWN_INFORMATION_DATASET } from '../known-information/built-in-dataset.js';
import { KnownInformationStore } from '../known-information/known-information-store.js';
import type { KnownInformationEntry } from '../known-information/types.js';

describe('KnownInformationStore matching', () => {
  it('matches a built-in exact entry', () => {
    const store = new KnownInformationStore(BUILT_IN_KNOWN_INFORMATION_DATASET);
    const matches = store.matchPath('/wp-login.php');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ id: 'built_in.wordpress.login', source: 'built_in', isPrimary: true });
  });

  it('matches a built-in prefix entry', () => {
    const store = new KnownInformationStore(BUILT_IN_KNOWN_INFORMATION_DATASET);
    const matches = store.matchPath('/.git/config');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ id: 'built_in.git.directory', source: 'built_in' });
  });

  it('returns no matches for an unregistered path', () => {
    const store = new KnownInformationStore(BUILT_IN_KNOWN_INFORMATION_DATASET);
    expect(store.matchPath('/nothing-registered')).toEqual([]);
  });

  it('never stores severity/priority/risk fields on an entry (structurally impossible)', () => {
    const entry = BUILT_IN_KNOWN_INFORMATION_DATASET[0];
    expect(entry).not.toHaveProperty('severity');
    expect(entry).not.toHaveProperty('priority');
    expect(entry).not.toHaveProperty('risk');
  });

  describe('source priority: user > project > built_in', () => {
    const path = '/members/signin';
    const builtIn: KnownInformationEntry = {
      id: 'built_in.signin',
      target: 'path',
      source: 'built_in',
      matchType: 'exact',
      pattern: path,
      title: 'Generic Sign-in',
    };
    const project: KnownInformationEntry = {
      id: 'project.signin',
      target: 'path',
      source: 'project',
      matchType: 'exact',
      pattern: path,
      title: 'This Site Member Sign-in',
    };
    const user: KnownInformationEntry = {
      id: 'user.signin',
      target: 'path',
      source: 'user',
      matchType: 'exact',
      pattern: path,
      title: 'User-Registered Sign-in',
    };

    it('a project entry overrides a built_in entry for the same path', () => {
      const store = new KnownInformationStore([builtIn, project]);
      const matches = store.matchPath(path);
      expect(matches[0]?.id).toBe('project.signin');
      expect(matches[0]?.isPrimary).toBe(true);
      expect(matches).toHaveLength(2); // both kept, only the winner is primary
    });

    it('a user entry overrides both project and built_in', () => {
      const store = new KnownInformationStore([builtIn, project, user]);
      const matches = store.matchPath(path);
      expect(matches[0]?.id).toBe('user.signin');
      expect(matches[0]?.isPrimary).toBe(true);
      expect(matches).toHaveLength(3);
    });
  });

  it('within the same source, exact beats prefix, and a longer prefix beats a shorter one', () => {
    const exactEntry: KnownInformationEntry = {
      id: 'p.exact',
      target: 'path',
      source: 'project',
      matchType: 'exact',
      pattern: '/admin/config.php',
      title: 'Exact',
    };
    const shortPrefix: KnownInformationEntry = {
      id: 'p.short-prefix',
      target: 'path',
      source: 'project',
      matchType: 'prefix',
      pattern: '/admin/',
      title: 'Short Prefix',
    };
    const longPrefix: KnownInformationEntry = {
      id: 'p.long-prefix',
      target: 'path',
      source: 'project',
      matchType: 'prefix',
      pattern: '/admin/config',
      title: 'Long Prefix',
    };

    const store = new KnownInformationStore([exactEntry, shortPrefix, longPrefix]);
    const matches = store.matchPath('/admin/config.php');
    expect(matches[0]?.id).toBe('p.exact');
    expect(matches[1]?.id).toBe('p.long-prefix');
    expect(matches[2]?.id).toBe('p.short-prefix');
  });
});
