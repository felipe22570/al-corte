/**
 * Al Corte · captura de alertas (F18, paso 44). Pure functions without Google APIs: Vitest runs this same file in a
 * plain script scope (integrations/apps-script/__tests__). `main.js` connects it to Gmail, UrlFetch and Properties.
 *
 * Only the phrase of a credit card alert leaves Google (D47): never the HTML, the footer or other emails.
 */
var AlCorteCapture = (function () {
  /**
   * Exact senders of the bank alerts. The real ones come from the `an.` and `ayn.` subdomains (seen on 20 and 24 Nov
   * 2026, each signed by its own subdomain); the bare domain stays as documented in R10. No other address is accepted.
   */
  var SENDERS = [
    "alertasynotificaciones@notificacionesbancolombia.com",
    "alertasynotificaciones@an.notificacionesbancolombia.com",
    "alertasynotificaciones@ayn.notificacionesbancolombia.com",
  ];
  var FROM_SEARCH = "from:(" + SENDERS.join(" OR ") + ")";
  var SEARCH_QUERY = FROM_SEARCH + " newer_than:2d";
  var GOOGLE_AUTHSERV_ID = "mx.google.com";
  var PHRASE_START = "Bancolombia:";
  /** Footers seen in real alerts: "Si tienes dudas…" (purchases) and "¿Dudas? Llamanos…" (virtual advances). */
  var PHRASE_END = /Si tienes dudas|¿?Dudas\?/;
  /** The search covers 2 days; an id seen earlier can no longer come back, and a resent one is a duplicate in the app. */
  var RETENTION_SECONDS = 2 * 24 * 60 * 60;
  /** Same limits as the ingest route (step 42). */
  var MAX_BODY_BYTES = 4096;
  var MAX_PHRASE_CHARS = 1000;
  /** "T.Cred *1234" or "T.Credito *1234" (both appear in real alerts), same pattern as the ingest route. */
  var CREDIT_CARD = /T\.\s?Cr[eé]d(?:ito)?\s*\*\s*\d{4}(?!\d)/i;
  /** Colombia has no daylight saving time: midnight in Bogotá is always 05:00 UTC. */
  var BOGOTA_OFFSET_HOURS = 5;
  var STATUSES = ["processed", "rejected", "discarded"];
  var RESULTS = ["created", "duplicate", "ignored"];
  /** Answers that would repeat for every message (secret, switch, rate limit, configuration, redirect). */
  var BLOCKING_STATUSES = [401, 403, 429, 503];
  var NAMED_ENTITIES = {
    nbsp: " ", amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'",
    aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
    Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü",
    iexcl: "¡", iquest: "¿", deg: "°",
  };
  var SUMMARY_LABELS = [
    ["found", "encontrados"], ["known", "ya vistos"], ["sent", "enviados"], ["created", "creados"],
    ["duplicate", "repetidos"], ["ignored", "ignorados por la app"], ["rejected", "rechazados"],
    ["discarded", "descartados"], ["retry", "por reintentar"],
  ];

  function headerValues(headers, name) {
    var wanted = name.toLowerCase();
    var values = [];
    for (var i = 0; i < (headers || []).length; i++) {
      if (String(headers[i].name).toLowerCase() === wanted) values.push(String(headers[i].value));
    }
    return values;
  }

  function stripComments(value) {
    var previous;
    do {
      previous = value;
      value = value.replace(/\([^()]*\)/g, " ");
    } while (value !== previous);
    return value;
  }

  function domainOf(identity) {
    var at = identity.lastIndexOf("@");
    return (at === -1 ? identity : identity.slice(at + 1)).toLowerCase();
  }

  /**
   * R10: Google adds its own `Authentication-Results` at the top of the message. Only that one counts; a header the
   * sender wrote below it is ignored. It must report `dkim=pass` for exactly the domain of the sender (an alert from
   * `an.notificacionesbancolombia.com` needs that signature), never a parent, a sibling or a lookalike.
   */
  function isGoogleDkimPass(headers, domain) {
    var wanted = String(domain || "").toLowerCase();
    if (!wanted) return false;
    var results = headerValues(headers, "authentication-results");
    if (results.length === 0) return false;
    var parts = stripComments(results[0]).split(";");
    var authserv = parts[0].trim().split(/\s+/)[0].toLowerCase();
    if (authserv !== GOOGLE_AUTHSERV_ID) return false;
    for (var i = 1; i < parts.length; i++) {
      var result = parts[i].trim();
      if (!/^dkim\s*=\s*pass\b/i.test(result)) continue;
      var properties = result.match(/\bheader\.[id]\s*=\s*[^\s;]+/gi) || [];
      for (var j = 0; j < properties.length; j++) {
        if (domainOf(properties[j].replace(/^header\.[id]\s*=\s*/i, "")) === wanted) return true;
      }
    }
    return false;
  }

  function senderAddress(from) {
    var match = /<([^>]+)>/.exec(from);
    return (match ? match[1] : from).trim().toLowerCase();
  }

  function decodeEntity(entity, body) {
    if (body.charAt(0) === "#") {
      var code = body.charAt(1).toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body) ? NAMED_ENTITIES[body] : entity;
  }

  /** For alerts without a plain text part. It runs inside Google, like the rest of the reading. */
  function htmlToText(html) {
    return String(html)
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(head|style|script)\b[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|table|h[1-6])\s*>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity);
  }

  function normalizeSpaces(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  /** The phrase from the last "Bancolombia:" before the first footer marker; null if either marker is missing. */
  function extractPhrase(text) {
    var source = String(text || "");
    var footer = PHRASE_END.exec(source);
    if (!footer) return null;
    var end = footer.index;
    var start = source.lastIndexOf(PHRASE_START, end);
    if (start === -1) return null;
    var phrase = normalizeSpaces(source.slice(start, end));
    return phrase.length > PHRASE_START.length ? phrase : null;
  }

  /** D44: savings and debit alerts never mention "T.Cred *NNNN" (or "T.Credito *NNNN") and are dropped here. */
  function hasCreditCardMarker(phrase) {
    return CREDIT_CARD.test(phrase);
  }

  /**
   * Search for the first reading: alerts since midnight in Bogotá `days` days before today. With 10 days on 24 Nov it
   * starts on 14 Nov at 00:00. Gmail takes `after:` in Unix seconds, which avoids its own time zone.
   */
  function backfillQuery(nowMs, days) {
    var bogota = new Date(nowMs - BOGOTA_OFFSET_HOURS * 60 * 60 * 1000);
    var since = Date.UTC(bogota.getUTCFullYear(), bogota.getUTCMonth(), bogota.getUTCDate() - days, BOGOTA_OFFSET_HOURS);
    return FROM_SEARCH + " after:" + Math.floor(since / 1000);
  }

  function partCharset(headers) {
    var types = headerValues(headers, "content-type");
    var match = types.length ? /charset\s*=\s*"?([^";\s]+)"?/i.exec(types[0]) : null;
    return match ? match[1] : "UTF-8";
  }

  function utf8Length(text) {
    var bytes = 0;
    for (var char of String(text)) {
      var code = char.codePointAt(0);
      bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    }
    return bytes;
  }

  /** `Utilities.computeHmacSha256Signature` returns signed bytes (-128..127). */
  function bytesToHex(bytes) {
    var hex = "";
    for (var i = 0; i < bytes.length; i++) hex += (bytes[i] & 0xff).toString(16).padStart(2, "0");
    return hex;
  }

  /** The exact body that is signed and sent (contract of step 42). */
  function buildBody(messageId, phrase) {
    return JSON.stringify({ message_id: messageId, phrase: phrase });
  }

  function phraseOf(message) {
    var fromPlain = message.plain ? extractPhrase(message.plain) : null;
    if (fromPlain) return fromPlain;
    return message.html ? extractPhrase(htmlToText(message.html)) : null;
  }

  /** Sender and DKIM first; the body is only read for a message that really comes from the bank. */
  function evaluateMessage(message) {
    var from = headerValues(message.headers, "from");
    var sender = from.length === 1 ? senderAddress(from[0]) : "";
    if (SENDERS.indexOf(sender) === -1) return { action: "reject", reason: "sender" };
    if (!isGoogleDkimPass(message.headers, domainOf(sender))) return { action: "reject", reason: "dkim" };
    var phrase = phraseOf(message);
    if (!phrase) return { action: "discard", reason: "no_phrase" };
    if (!hasCreditCardMarker(phrase)) return { action: "discard", reason: "no_credit_card" };
    if (phrase.length > MAX_PHRASE_CHARS || utf8Length(buildBody(message.id, phrase)) > MAX_BODY_BYTES) {
      return { action: "reject", reason: "too_large" };
    }
    return { action: "send", phrase: phrase };
  }

  /** What to do with each answer of the app (table of the folder README). */
  function classifyResponse(status, body) {
    if (status === 200) {
      var parsed = null;
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = null;
      }
      if (parsed && parsed.ok === true && RESULTS.indexOf(parsed.result) !== -1) return { outcome: "processed", result: parsed.result };
      return { outcome: "retry", blocking: false };
    }
    if (status === 400 || status === 413) return { outcome: "rejected" };
    var blocking = BLOCKING_STATUSES.indexOf(status) !== -1 || (status >= 300 && status < 400);
    return { outcome: "retry", blocking: blocking };
  }

  function isEntry(value) {
    return Boolean(value) && typeof value === "object" && STATUSES.indexOf(value.s) !== -1 && typeof value.t === "number" && isFinite(value.t);
  }

  function parseState(json) {
    if (!json) return {};
    try {
      var parsed = JSON.parse(json);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function pruneState(state, nowSeconds) {
    var kept = {};
    Object.keys(state || {}).forEach(function (id) {
      var entry = state[id];
      if (isEntry(entry) && nowSeconds - entry.t <= RETENTION_SECONDS) kept[id] = { s: entry.s, t: entry.t };
    });
    return kept;
  }

  function count(summary, key) {
    summary[key] = (summary[key] || 0) + 1;
  }

  /**
   * One run of the hourly trigger. A message is marked only when the app answered for good or it never had to be sent;
   * anything else (no connection, rotated secret, capture off, rate limit) is retried in the next run while the message
   * is younger than 2 days.
   *
   * Options for the first reading: `retryDiscarded` evaluates again the messages discarded before (for example after a
   * filter change) and `canContinue` stops before Apps Script's time limit, saving what was done.
   */
  function processMessages(ids, state, deps, options) {
    var settings = options || {};
    var next = {};
    Object.keys(state || {}).forEach(function (id) {
      if (isEntry(state[id]) && !(settings.retryDiscarded && state[id].s === "discarded")) next[id] = { s: state[id].s, t: state[id].t };
    });
    var summary = { found: ids.length, known: 0, sent: 0, created: 0, duplicate: 0, ignored: 0, rejected: 0, discarded: 0, retry: 0 };
    var blocked = false;
    var mark = function (id, status) {
      next[id] = { s: status, t: deps.nowSeconds() };
    };

    ids.forEach(function (id) {
      if (Object.prototype.hasOwnProperty.call(next, id)) {
        summary.known += 1;
        return;
      }
      if (!blocked && settings.canContinue && !settings.canContinue()) {
        blocked = true;
        count(summary, "time_limit");
      }
      if (blocked) {
        summary.retry += 1;
        return;
      }
      var message;
      try {
        message = deps.load(id);
      } catch {
        summary.retry += 1;
        count(summary, "load_error");
        return;
      }
      var evaluation = evaluateMessage({ id: id, headers: message.headers, plain: message.plain, html: message.html });
      if (evaluation.action !== "send") {
        var status = evaluation.action === "reject" ? "rejected" : "discarded";
        mark(id, status);
        summary[status] += 1;
        count(summary, evaluation.reason);
        return;
      }

      var timestamp = String(deps.nowSeconds());
      var body = buildBody(id, evaluation.phrase);
      var signature = "v1=" + bytesToHex(deps.sign(timestamp + "." + body));
      var response;
      try {
        response = deps.send({ body: body, timestamp: timestamp, signature: signature });
      } catch {
        summary.retry += 1;
        count(summary, "network_error");
        blocked = true;
        return;
      }
      summary.sent += 1;
      var answer = classifyResponse(response.status, response.body);
      if (answer.outcome === "processed") {
        mark(id, "processed");
        summary[answer.result] += 1;
        return;
      }
      count(summary, response.status === 200 ? "unexpected_answer" : "http_" + response.status);
      if (answer.outcome === "rejected") {
        mark(id, "rejected");
        summary.rejected += 1;
        return;
      }
      summary.retry += 1;
      if (answer.blocking) blocked = true;
    });

    return { state: next, summary: summary };
  }

  /** Counts and reasons only: the execution log never shows phrases, merchants or message ids. */
  function describeSummary(summary) {
    var known = SUMMARY_LABELS.map(function (pair) {
      return pair[0];
    });
    var parts = SUMMARY_LABELS.map(function (pair) {
      return pair[1] + "=" + (summary[pair[0]] || 0);
    });
    var reasons = Object.keys(summary).filter(function (key) {
      return known.indexOf(key) === -1;
    }).sort().map(function (key) {
      return key + "=" + summary[key];
    });
    return "Captura: " + parts.join(", ") + (reasons.length ? ". Motivos: " + reasons.join(", ") : "");
  }

  return {
    SENDERS: SENDERS,
    SEARCH_QUERY: SEARCH_QUERY,
    backfillQuery: backfillQuery,
    RETENTION_SECONDS: RETENTION_SECONDS,
    MAX_BODY_BYTES: MAX_BODY_BYTES,
    MAX_PHRASE_CHARS: MAX_PHRASE_CHARS,
    isGoogleDkimPass: isGoogleDkimPass,
    senderAddress: senderAddress,
    htmlToText: htmlToText,
    extractPhrase: extractPhrase,
    hasCreditCardMarker: hasCreditCardMarker,
    partCharset: partCharset,
    utf8Length: utf8Length,
    bytesToHex: bytesToHex,
    buildBody: buildBody,
    evaluateMessage: evaluateMessage,
    classifyResponse: classifyResponse,
    parseState: parseState,
    pruneState: pruneState,
    processMessages: processMessages,
    describeSummary: describeSummary,
  };
})();
