import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const version = manifest.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Release version must be X.Y.Z.');
const checkOnly = process.argv[2] === '--check';
const tag = checkOnly ? undefined : process.argv[2];
if (tag !== undefined && tag !== `v${version}`) throw new Error(`Tag ${tag} does not match package version ${version}.`);
const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const heading = `## [${version}] - `;
const lines = changelog.split('\n');
const start = lines.findIndex(line => line.startsWith(heading));
if (start < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(lines[start].slice(heading.length))) throw new Error('Add a dated changelog entry for this version.');
const next = lines.findIndex((line, index) => index > start && (line.startsWith('## ') || /^\[[^\]]+\]:/.test(line)));
const notes = lines.slice(start + 1, next < 0 ? undefined : next).join('\n').trim();
if (!notes) throw new Error('Release notes cannot be empty.');
if (!checkOnly) console.log(`${notes}\n\n### Install or update\n\n\`\`\`sh\nbb plugin install 'git:https://github.com/AdzeB/bb-plugin-md-prompt.git@^${version}'\n# Existing managed installs:\nbb plugin update md-prompt\n\`\`\`\n\nRequires BB ${manifest.engines.bb} and Plugin SDK ${manifest.engines.bbPluginSdk}.\n\nSee the [changelog](https://github.com/AdzeB/bb-plugin-md-prompt/blob/${tag ?? `v${version}`}/CHANGELOG.md) for this release's history.\n`);
