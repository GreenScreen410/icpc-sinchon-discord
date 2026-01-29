import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JWT } from "google-auth-library";
import { GoogleSpreadsheet } from "google-spreadsheet";

const creds = JSON.parse(readFileSync(join(process.cwd(), "creds.json"), "utf8"));

const serviceAccountAuth = new JWT({
	email: creds.client_email,
	key: creds.private_key,
	scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export const getDoc = async (spreadsheetId: string) => {
	const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
	await doc.loadInfo();
	return doc;
};
