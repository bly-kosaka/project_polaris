import type { KnownInformationEntry } from './types.js';

export const BUILT_IN_KNOWN_INFORMATION_DATASET_VERSION = '2026-08-28';

/**
 * Factual, non-evaluative descriptions only — per 08_Detection_Rules.md §16.4.
 * "危険"、"攻撃"、"悪性" or any other evaluative word is never stored here.
 */
export const BUILT_IN_KNOWN_INFORMATION_DATASET: KnownInformationEntry[] = [
  {
    id: 'built_in.wordpress.login',
    target: 'path',
    source: 'built_in',
    matchType: 'exact',
    pattern: '/wp-login.php',
    title: 'WordPress Login Path',
    description: 'WordPressで一般的にログイン処理に使用されるPathです。',
  },
  {
    id: 'built_in.wordpress.xmlrpc',
    target: 'path',
    source: 'built_in',
    matchType: 'exact',
    pattern: '/xmlrpc.php',
    title: 'WordPress XML-RPC Path',
    description: 'WordPressのXML-RPC機能で使用されるPathです。',
  },
  {
    id: 'built_in.git.directory',
    target: 'path',
    source: 'built_in',
    matchType: 'prefix',
    pattern: '/.git/',
    title: 'Git Metadata Path',
    description: 'Gitの管理情報が配置されることがあるPathです。',
  },
  {
    id: 'built_in.env.file',
    target: 'path',
    source: 'built_in',
    matchType: 'exact',
    pattern: '/.env',
    title: 'Environment Configuration File',
    description: 'アプリケーションの環境設定に使用されることがあるファイル名です。',
  },
];
