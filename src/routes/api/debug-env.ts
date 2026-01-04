import { json } from "@solidjs/router";

export async function GET() {
	return json({
		processEnvKeys: Object.keys(process.env),
		importMetaEnvKeys: Object.keys(import.meta.env || {}),
		databaseUrlInProcess: !!process.env.DATABASE_URL,
		databaseUrlInMeta: !!(import.meta as any).env?.DATABASE_URL,
	});
}
