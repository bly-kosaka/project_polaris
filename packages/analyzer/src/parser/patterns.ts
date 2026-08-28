/**
 * Combined Log Format — the default access log layout for both Apache
 * ("combined") and Nginx (`log_format combined` is the same shape).
 */
export const COMBINED_LOG_PATTERN =
  /^(?<sourceIp>\S+) \S+ \S+ \[(?<timestampRaw>[^\]]*)\] "(?<requestRaw>[^"]*)" (?<statusRaw>\S+) (?<bytesRaw>\S+) "(?<referrer>[^"]*)" "(?<userAgent>[^"]*)"$/;

/** Common Log Format (CLF) — no referrer / user-agent fields. */
export const COMMON_LOG_PATTERN =
  /^(?<sourceIp>\S+) \S+ \S+ \[(?<timestampRaw>[^\]]*)\] "(?<requestRaw>[^"]*)" (?<statusRaw>\S+) (?<bytesRaw>\S+)$/;
