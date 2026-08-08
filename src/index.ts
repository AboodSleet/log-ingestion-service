import {sql} from "./db";

async function main() {
 const result = await sql`SELECT 1 AS connected`;
 console.log(result);
}

main();
