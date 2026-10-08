// Runs before every test file. The suite writes real rows (through sign-up, sessions, messages), so it must
// never point at a database someone cares about by accident: it needs a database of its own
// (TEST_DATABASE_URL), or an explicit statement that sharing one is fine (a throwaway dev database).
// Every test makes its own workspace and deletes it, so nothing else in the database is touched.
if (process.env["NODE_ENV"] === "production") throw new Error("Refusing to run the tests with NODE_ENV=production");

if (process.env["TEST_DATABASE_URL"]) {
  process.env["DATABASE_URL"] = process.env["TEST_DATABASE_URL"];
} else if (process.env["ALLOW_TESTS_ON_SHARED_DB"] !== "1") {
  throw new Error(
    "Set TEST_DATABASE_URL to a database for the tests (see README), or ALLOW_TESTS_ON_SHARED_DB=1 to run them " +
      "against DATABASE_URL — each test creates and deletes its own workspace."
  );
}
