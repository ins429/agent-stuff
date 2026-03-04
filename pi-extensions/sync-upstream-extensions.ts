/**
 * Sync Upstream Pi Extensions
 *
 * Provides a `/sync-upstream-extensions` command that checks all local pi extension
 * files tagged with an `@upstream <url>` directive and offers to update them from
 * the upstream source, skipping files without the directive (e.g. review.ts).
 *
 * Usage:
 *   /sync-upstream-extensions          - interactive: shows diff for each changed file
 *   /sync-upstream-extensions --check  - non-interactive: print which files are out of date
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { DynamicBorder, BorderedLoader } from "@mariozechner/pi-coding-agent";
import { Container, Text } from "@mariozechner/pi-tui";
import path from "node:path";
import { promises as fs } from "node:fs";

const UPSTREAM_DIRECTIVE = /^\/\/\s*@upstream\s+(https?:\/\/\S+)/m;

/** Convert a github.com/…/blob/…/file URL to raw.githubusercontent.com */
function toRawUrl(url: string): string {
	// https://github.com/<owner>/<repo>/blob/<ref>/<path>
	const match = url.match(
		/https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/,
	);
	if (match) {
		const [, owner, repo, ref, filePath] = match;
		return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`;
	}
	return url;
}

async function fetchText(url: string): Promise<string | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	}
}

type ExtensionFile = {
	file: string;
	localPath: string;
	upstreamUrl: string;
	rawUrl: string;
};

type SyncResult = {
	file: string;
	upstreamUrl: string;
	status: "up-to-date" | "changed" | "fetch-error";
	localContent: string;
	upstreamContent?: string;
};

/** Discover all .ts files in the same directory that have an @upstream directive */
async function discoverUpstreamFiles(extensionsDir: string): Promise<ExtensionFile[]> {
	const entries = await fs.readdir(extensionsDir);
	const results: ExtensionFile[] = [];

	for (const entry of entries) {
		if (!entry.endsWith(".ts")) continue;
		const localPath = path.join(extensionsDir, entry);
		try {
			const content = await fs.readFile(localPath, "utf8");
			const match = content.match(UPSTREAM_DIRECTIVE);
			if (match) {
				const upstreamUrl = match[1];
				results.push({
					file: entry,
					localPath,
					upstreamUrl,
					rawUrl: toRawUrl(upstreamUrl),
				});
			}
		} catch {
			// skip unreadable files
		}
	}

	return results;
}

async function checkFiles(files: ExtensionFile[]): Promise<SyncResult[]> {
	return Promise.all(
		files.map(async (f): Promise<SyncResult> => {
			const localContent = await fs.readFile(f.localPath, "utf8");
			const upstreamContent = await fetchText(f.rawUrl);

			if (upstreamContent === null) {
				return { file: f.file, upstreamUrl: f.upstreamUrl, status: "fetch-error", localContent };
			}

			// Compare ignoring the @upstream directive line itself so that adding
			// the directive to a previously identical file doesn't count as a change.
			const localStripped = localContent.replace(UPSTREAM_DIRECTIVE, "").trim();
			const upstreamStripped = upstreamContent.trim();

			const status = localStripped === upstreamStripped ? "up-to-date" : "changed";
			return { file: f.file, upstreamUrl: f.upstreamUrl, status, localContent, upstreamContent };
		}),
	);
}

/** Produce a simple unified-ish text diff summary (line counts, first differing lines) */
function summarizeDiff(local: string, upstream: string): string {
	const localLines = local.split("\n");
	const upstreamLines = upstream.split("\n");

	const added = upstreamLines.length - localLines.length;
	const sign = added >= 0 ? `+${added}` : `${added}`;

	// Find first differing line for context
	let firstDiff = -1;
	const maxCheck = Math.max(localLines.length, upstreamLines.length);
	for (let i = 0; i < maxCheck; i++) {
		if (localLines[i] !== upstreamLines[i]) {
			firstDiff = i + 1;
			break;
		}
	}

	let summary = `Local: ${localLines.length} lines  Upstream: ${upstreamLines.length} lines  (${sign} lines)`;
	if (firstDiff > 0) {
		summary += `\nFirst difference at line ${firstDiff}`;
		const localLine = localLines[firstDiff - 1] ?? "(end of file)";
		const upstreamLine = upstreamLines[firstDiff - 1] ?? "(end of file)";
		summary += `\n  local:    ${localLine.slice(0, 120)}`;
		summary += `\n  upstream: ${upstreamLine.slice(0, 120)}`;
	}
	return summary;
}

export default function syncUpstreamExtension(pi: ExtensionAPI) {
	pi.registerCommand("sync-upstream-extensions", {
		description: "Check and update pi extensions that have an @upstream directive",
		handler: async (args, ctx) => {
			const checkOnly = args?.trim() === "--check";
			const extensionsDir = path.dirname(new URL(import.meta.url).pathname);

			// Discover files with @upstream directives
			ctx.ui.notify("Scanning for @upstream directives...", "info");
			const files = await discoverUpstreamFiles(extensionsDir);

			if (files.length === 0) {
				ctx.ui.notify("No extensions with @upstream directives found.", "info");
				return;
			}

			// Fetch and compare all files
			ctx.ui.notify(`Checking ${files.length} upstream file(s)...`, "info");
			const results = await checkFiles(files);

			const changed = results.filter((r) => r.status === "changed");
			const errors = results.filter((r) => r.status === "fetch-error");
			const upToDate = results.filter((r) => r.status === "up-to-date");

			// Always report summary
			const lines: string[] = [];
			if (upToDate.length > 0) lines.push(`✓ Up to date (${upToDate.length}): ${upToDate.map((r) => r.file).join(", ")}`);
			if (errors.length > 0) lines.push(`✗ Fetch errors (${errors.length}): ${errors.map((r) => r.file).join(", ")}`);
			if (changed.length > 0) lines.push(`↑ Updates available (${changed.length}): ${changed.map((r) => r.file).join(", ")}`);

			ctx.ui.notify(lines.join("\n"), changed.length > 0 ? "warning" : "info");

			if (checkOnly || changed.length === 0) {
				return;
			}

			// Interactive update flow — go through each changed file
			for (const result of changed) {
				const diff = summarizeDiff(result.localContent, result.upstreamContent!);

				const choice = await ctx.ui.select(
					`Update ${result.file}?\n\n${diff}\n\nUpstream: ${result.upstreamUrl}`,
					["Update", "Skip", "Abort"],
				);

				if (choice === undefined || choice === "Abort") {
					ctx.ui.notify("Sync aborted.", "info");
					return;
				}

				if (choice === "Skip") {
					continue;
				}

				// Update: preserve the @upstream directive, write upstream content
				const upstreamRaw = result.upstreamContent!;

				// Build new content: directive line + upstream content (which won't have the directive)
				const directiveLine = `// @upstream ${result.upstreamUrl}`;
				const newContent = `${directiveLine}\n\n${upstreamRaw.trimStart()}`;

				try {
					await fs.writeFile(result.file.startsWith("/") ? result.file : path.join(extensionsDir, result.file), newContent, "utf8");
					ctx.ui.notify(`✓ Updated ${result.file}`, "info");
				} catch (err) {
					ctx.ui.notify(`Failed to write ${result.file}: ${err instanceof Error ? err.message : String(err)}`, "error");
				}
			}

			ctx.ui.notify("Sync complete.", "info");
		},
	});
}
