/** Wraps an array of raw log lines as the AsyncIterable<string> the streaming pipeline expects. */
export async function* linesFrom(rawLines: string[]): AsyncGenerator<string> {
  for (const line of rawLines) yield line;
}

export const SAMPLE_LOG_LINES = [
  '192.0.2.10 - - [10/Oct/2023:17:00:00 +0000] "GET /popular.html HTTP/1.1" 200 1024 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"',
  '192.0.2.10 - - [10/Oct/2023:17:00:30 +0000] "GET /popular.html HTTP/1.1" 200 1024 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"',
  '198.51.100.20 - - [10/Oct/2023:17:01:00 +0000] "GET /wp-login.php HTTP/1.1" 200 512 "-" "Mozilla/5.0 (X11; Linux x86_64)"',
  '198.51.100.20 - - [10/Oct/2023:17:01:10 +0000] "POST /wp-login.php HTTP/1.1" 200 512 "-" "Mozilla/5.0 (X11; Linux x86_64)"',
  '203.0.113.30 - - [10/Oct/2023:17:02:00 +0000] "GET /search?q=polaris&token=abc123 HTTP/1.1" 200 2048 "-" "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)"',
  '203.0.113.31 - - [10/Oct/2023:17:03:00 +0000] "GET /missing.html HTTP/1.1" 404 209 "-" "curl/8.0"',
];
