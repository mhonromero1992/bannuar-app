// What tests build with instead of .env. The mock project address never resolves; the jest setup also
// fails any test whose request reaches a real *.supabase.co host.
module.exports = {
  SUPABASE_URL: 'https://mock.supabase.test',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key',
  WEBSITE_URL: 'https://bannuar.example',
  EMPLOYEE_LOGIN_DOMAIN: 'employees.bannuar.invalid',
  PUSH_ENABLED: 'true',
};
