import { client, userCode, sessions, users, provider } from "./lib/client";

test("sign-in with email", async () => {
  const email = "user@mail.com";
  await client.auth.signin({ email }, {});
  const result = await client.auth.verify({ email, code: userCode }, {});
  console.info(result?.session);
  expect(result !== null);
});

test("sign-in with provider", async () => {
  const session = await provider.create({}, {});
  console.info(session);
  expect(session.user.provider === "provider");
});

test("two sessions in the database", async () => {
  expect(sessions.length === 2);
});

test("two users in the database", async () => {
  expect(users.length === 2);
});
