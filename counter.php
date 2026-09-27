<?php
// Visitor counter backed by data/visits.json.
// GET  -> returns the current totals.
// POST -> increments (the page only POSTs once per browser per day).

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method not allowed']);
    exit;
}

$dir = __DIR__ . '/data';
$file = $dir . '/visits.json';

if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
    http_response_code(500);
    echo json_encode(['error' => 'storage unavailable']);
    exit;
}

$fp = fopen($file, 'c+');
if ($fp === false) {
    http_response_code(500);
    echo json_encode(['error' => 'storage unavailable']);
    exit;
}

// Exclusive lock so simultaneous visits don't overwrite each other.
flock($fp, LOCK_EX);

$data = json_decode(stream_get_contents($fp) ?: '', true);
if (!is_array($data) || !isset($data['total'])) {
    $data = ['total' => 0, 'daily' => []];
}

$today = gmdate('Y-m-d');

if ($method === 'POST') {
    $data['total'] = (int) $data['total'] + 1;
    $data['daily'][$today] = (int) ($data['daily'][$today] ?? 0) + 1;

    // Keep the last 90 days of daily counts only.
    ksort($data['daily']);
    $data['daily'] = array_slice($data['daily'], -90, null, true);
    $data['updated'] = gmdate('c');

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp);
}

flock($fp, LOCK_UN);
fclose($fp);

echo json_encode([
    'total' => (int) $data['total'],
    'today' => (int) ($data['daily'][$today] ?? 0),
]);
