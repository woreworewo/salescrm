export function assertLocalService(value, port) {
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" || url.port !== String(port))
    throw new Error("Only the configured loopback service is permitted.");
  return url;
}

export function localEnvironment(status, password) {
  assertLocalService(status.API_URL, 54321);
  assertLocalService(status.DB_URL, 54322);
  const variables = {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      status.PUBLISHABLE_KEY || status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SECRET_KEY || status.SERVICE_ROLE_KEY,
    CRM_APP_URL: "http://127.0.0.1:3000",
    CRM_DEMO_MODE: "false",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "54325",
    SMTP_FROM: "no-reply@salescrm.local",
    SMTP_SECURE: "false",
    SMTP_REQUIRE_TLS: "false",
    CRM_LOCAL_ONLY: "true",
    CRM_LOCAL_DATABASE_URL: status.DB_URL,
    CRM_LOCAL_TEST_PASSWORD: password,
  };
  if (
    Object.values(variables).some(
      (value) => typeof value !== "string" || !value || /[\r\n]/.test(value),
    )
  )
    throw new Error("Incomplete or invalid local status.");
  return (
    Object.entries(variables)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n"
  );
}
