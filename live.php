<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const TRACK_ID = '2109229b622d90608882c752782d56b2';
const CACHE = '/tmp/bony-geduko-live.json';
const FRESH_SECONDS = 4;

if (is_file(CACHE) && time() - filemtime(CACHE) < FRESH_SECONDS) {
    readfile(CACHE);
    exit;
}

$payload = pull_live();
if (isset($payload['error'])) {
    if (is_file(CACHE)) {
        readfile(CACHE);
        exit;
    }
    http_response_code(502);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

$json = json_encode($payload, JSON_UNESCAPED_UNICODE);
@file_put_contents(CACHE, $json, LOCK_EX);
echo $json;

function pull_live(): array
{
    $errno = 0;
    $errstr = '';
    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'SNI_enabled' => true,
            'peer_name' => 'kartchrono.com',
        ],
    ]);
    $socket = @stream_socket_client(
        'ssl://kartchrono.com:9180',
        $errno,
        $errstr,
        5,
        STREAM_CLIENT_CONNECT,
        $context,
    );
    if (!$socket) {
        return ['error' => 'хронометраж недоступен'];
    }
    stream_set_timeout($socket, 4);

    $key = base64_encode(random_bytes(16));
    $request = "GET / HTTP/1.1\r\n"
        . "Host: kartchrono.com:9180\r\n"
        . "Upgrade: websocket\r\n"
        . "Connection: Upgrade\r\n"
        . "Origin: https://geduko.kartchrono.com\r\n"
        . "Sec-WebSocket-Key: {$key}\r\n"
        . "Sec-WebSocket-Version: 13\r\n\r\n";
    fwrite($socket, $request);

    $header = '';
    while (!str_contains($header, "\r\n\r\n")) {
        $chunk = fread($socket, 2048);
        if ($chunk === false || $chunk === '') {
            fclose($socket);
            return ['error' => 'нет ответа хронометража'];
        }
        $header .= $chunk;
        if (strlen($header) > 8192) {
            break;
        }
    }
    if (!str_contains($header, ' 101 ')) {
        fclose($socket);
        return ['error' => 'хронометраж отклонил соединение'];
    }

    $split = strpos($header, "\r\n\r\n");
    $buffer = $split === false ? '' : substr($header, $split + 4);
    ws_send($socket, json_encode(['trackId' => TRACK_ID], JSON_UNESCAPED_UNICODE));

    $messages = [];
    $laps = [];
    $deadline = microtime(true) + 2.5;
    while (microtime(true) < $deadline) {
        $frame = ws_read($socket, $buffer, $deadline);
        if ($frame === null) {
            break;
        }
        if ($frame['opcode'] === 0x1) {
            $decoded = json_decode($frame['data'], true);
            if (is_array($decoded)) {
                $messages[] = $decoded;
            }
        } elseif ($frame['opcode'] === 0x2) {
            $laps[] = base64_encode($frame['data']);
        } elseif ($frame['opcode'] === 0x8) {
            break;
        } elseif ($frame['opcode'] === 0x9) {
            ws_send($socket, $frame['data'], 0xA);
        }
        if ($messages !== [] && $laps !== []) {
            $deadline = min($deadline, microtime(true) + 0.35);
        }
    }
    fclose($socket);

    if ($messages === [] && $laps === []) {
        return ['error' => 'пустой ответ хронометража'];
    }
    return ['json' => $messages, 'laps' => $laps];
}

function ws_send($socket, string $payload, int $opcode = 0x1): void
{
    $length = strlen($payload);
    $mask = random_bytes(4);
    $header = chr(0x80 | $opcode);
    if ($length < 126) {
        $header .= chr(0x80 | $length);
    } elseif ($length < 65536) {
        $header .= chr(0x80 | 126) . pack('n', $length);
    } else {
        $header .= chr(0x80 | 127) . pack('J', $length);
    }
    $masked = '';
    for ($i = 0; $i < $length; $i++) {
        $masked .= $payload[$i] ^ $mask[$i % 4];
    }
    fwrite($socket, $header . $mask . $masked);
}

function ws_read($socket, string &$buffer, float $deadline): ?array
{
    while (true) {
        $frame = ws_take_frame($buffer);
        if ($frame !== null) {
            return $frame;
        }
        if (microtime(true) >= $deadline) {
            return null;
        }
        $remain = max(1, (int) ceil($deadline - microtime(true)));
        stream_set_timeout($socket, $remain);
        $chunk = fread($socket, 65536);
        if ($chunk === false || $chunk === '') {
            $meta = stream_get_meta_data($socket);
            if (!empty($meta['timed_out']) || !empty($meta['eof'])) {
                return null;
            }
            usleep(20000);
            continue;
        }
        $buffer .= $chunk;
    }
}

function ws_take_frame(string &$buffer): ?array
{
    if (strlen($buffer) < 2) {
        return null;
    }
    $first = ord($buffer[0]);
    $second = ord($buffer[1]);
    $opcode = $first & 0x0F;
    $masked = ($second & 0x80) !== 0;
    $length = $second & 0x7F;
    $offset = 2;
    if ($length === 126) {
        if (strlen($buffer) < 4) {
            return null;
        }
        $length = unpack('n', substr($buffer, 2, 2))[1];
        $offset = 4;
    } elseif ($length === 127) {
        if (strlen($buffer) < 10) {
            return null;
        }
        $parts = unpack('N2', substr($buffer, 2, 8));
        $length = ($parts[1] << 32) + $parts[2];
        $offset = 10;
    }
    $maskLength = $masked ? 4 : 0;
    $total = $offset + $maskLength + $length;
    if (strlen($buffer) < $total) {
        return null;
    }
    $data = substr($buffer, $offset + $maskLength, $length);
    if ($masked) {
        $mask = substr($buffer, $offset, 4);
        $unmasked = '';
        for ($i = 0; $i < $length; $i++) {
            $unmasked .= $data[$i] ^ $mask[$i % 4];
        }
        $data = $unmasked;
    }
    $buffer = substr($buffer, $total);
    return ['opcode' => $opcode, 'data' => $data];
}
