/*
# Lock down internal database functions

Removes API execution access from public helper functions. The signup trigger still invokes
handle_new_user internally, and server-side grading still invokes get_percentile with the
service role, but browser roles cannot call either function directly.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_percentile(uuid, text, numeric) FROM PUBLIC, anon, authenticated;