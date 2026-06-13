// Replaces GOOGLE_CLIENT_ID line in an env file (first-wins dotenv semantics).
const fs = require("fs");
const file = process.argv[2];
const newId = process.argv[3];
let txt = fs.readFileSync(file, "utf8");
const re = /^GOOGLE_CLIENT_ID=.*$/m;
if (re.test(txt)) {
  txt = txt.replace(/^GOOGLE_CLIENT_ID=.*$/gm, `GOOGLE_CLIENT_ID=${newId}`);
} else {
  txt += `\nGOOGLE_CLIENT_ID=${newId}\n`;
}
fs.writeFileSync(file, txt);
console.log("GOOGLE_CLIENT_ID updated in", file);
