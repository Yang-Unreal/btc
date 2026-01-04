import postgres from "postgres";

async function testConnection() {
	const url = process.env.DATABASE_URL;
	console.log("DATABASE_URL present:", !!url);
	if (!url) {
		console.error("DATABASE_URL is not set");
		process.exit(1);
	}

	const sql = postgres(url);
	try {
		console.log("Connecting to database...");
		const result =
			await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
		console.log("Tables found:", result);
	} catch (error) {
		console.error("Connection failed:", error);
		process.exit(1);
	} finally {
		await sql.end();
	}
}

testConnection();
