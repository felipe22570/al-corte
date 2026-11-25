/**
 * Al Corte · captura de alertas (F18, paso 44). Runs every hour in the owner's Google account (D43) with the advanced
 * Gmail service and `gmail.readonly`: it never changes, labels or sends emails. The reading rules live in `core.js`.
 *
 * Script properties (Project Settings → Script properties):
 * - INGEST_URL: https://<production domain>/api/ingest/alerts
 * - INGEST_SIGNING_SECRET: same value as in Vercel (D51)
 * The script keeps its own state in AL_CORTE_CAPTURE_STATE; do not edit it by hand.
 */

var CAPTURE_HANDLER = "capturePurchaseAlerts";
var STATE_PROPERTY = "AL_CORTE_CAPTURE_STATE";
var REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/script.external_request",
  "https://www.googleapis.com/auth/script.scriptapp",
];
/** Days of the first reading: installed on 24 Nov, it reads from 14 Nov at 00:00 in Bogotá. */
var BACKFILL_DAYS = 10;
/** The ingest route accepts 30 requests per minute (step 42). */
var BACKFILL_PAUSE_MS = 2500;
/** Apps Script stops an execution at 6 minutes; the first reading saves its state before that. */
var BACKFILL_BUDGET_MS = 4.5 * 60 * 1000;

/** Hourly trigger: alerts of the last 2 days. Logs counts only, never phrases, merchants or message ids. */
function capturePurchaseAlerts() {
  runCapture_(AlCorteCapture.SEARCH_QUERY, {});
}

/**
 * First reading: alerts of the last 10 days, paced to stay under the route limit. It also evaluates again the alerts
 * discarded before. Safe to run again: what the app already has comes back as a duplicate and creates nothing.
 */
function backfillAlerts() {
  var started = Date.now();
  var sent = 0;
  runCapture_(AlCorteCapture.backfillQuery(started, BACKFILL_DAYS), {
    retryDiscarded: true,
    canContinue: function () {
      return Date.now() - started < BACKFILL_BUDGET_MS;
    },
    beforeSend: function () {
      if (sent > 0) Utilities.sleep(BACKFILL_PAUSE_MS);
      sent += 1;
    },
  });
}

/** Run once from the editor: asks for the permissions, leaves a single hourly trigger and does the first reading. */
function installTrigger() {
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, REQUIRED_SCOPES);
  removeTrigger();
  ScriptApp.newTrigger(CAPTURE_HANDLER).timeBased().everyHours(1).create();
  console.log("Activador instalado: " + CAPTURE_HANDLER + " cada hora.");
  backfillAlerts();
}

/** Stops the capture from this side. Revoking access in the Google account also stops it. */
function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === CAPTURE_HANDLER) ScriptApp.deleteTrigger(trigger);
  });
}

function runCapture_(query, options) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    console.log("Otra ejecución sigue en curso; esta se omite.");
    return;
  }
  try {
    var properties = PropertiesService.getScriptProperties();
    var url = properties.getProperty("INGEST_URL");
    var secret = properties.getProperty("INGEST_SIGNING_SECRET");
    if (!url || !/^https:\/\//.test(url) || !secret) {
      throw new Error("Faltan las propiedades INGEST_URL (https) o INGEST_SIGNING_SECRET.");
    }
    var nowSeconds = function () {
      return Math.floor(Date.now() / 1000);
    };
    var state = AlCorteCapture.pruneState(AlCorteCapture.parseState(properties.getProperty(STATE_PROPERTY)), nowSeconds());
    var run = AlCorteCapture.processMessages(listAlertIds_(query), state, {
      nowSeconds: nowSeconds,
      load: loadMessage_,
      sign: function (text) {
        return Utilities.computeHmacSha256Signature(text, secret, Utilities.Charset.UTF_8);
      },
      send: function (request) {
        if (options.beforeSend) options.beforeSend();
        return postAlert_(url, request);
      },
    }, { retryDiscarded: Boolean(options.retryDiscarded), canContinue: options.canContinue });
    properties.setProperty(STATE_PROPERTY, JSON.stringify(run.state));
    console.log(AlCorteCapture.describeSummary(run.summary));
  } finally {
    lock.releaseLock();
  }
}

/** Ids that match the search, oldest first. */
function listAlertIds_(query) {
  var ids = [];
  var pageToken;
  do {
    var page = Gmail.Users.Messages.list("me", { q: query, maxResults: 100, pageToken: pageToken });
    (page.messages || []).forEach(function (item) {
      ids.push(item.id);
    });
    pageToken = page.nextPageToken;
  } while (pageToken);
  return ids.reverse();
}

function loadMessage_(id) {
  var message = Gmail.Users.Messages.get("me", id, { format: "full" });
  var payload = message.payload || {};
  return { id: id, headers: payload.headers || [], plain: findPartText_(payload, "text/plain"), html: findPartText_(payload, "text/html") };
}

/** First inline part of that type, decoded with its charset. Attachments are skipped. */
function findPartText_(part, mimeType) {
  if (!part) return null;
  if (String(part.mimeType).toLowerCase() === mimeType && !part.filename && part.body && part.body.data) {
    return decodeBody_(part.body.data, AlCorteCapture.partCharset(part.headers || []));
  }
  var children = part.parts || [];
  for (var i = 0; i < children.length; i++) {
    var text = findPartText_(children[i], mimeType);
    if (text !== null) return text;
  }
  return null;
}

/** The advanced service returns the body as bytes; a base64url string is also accepted. */
function decodeBody_(data, charset) {
  var bytes = typeof data === "string" ? Utilities.base64DecodeWebSafe(data) : data;
  try {
    return Utilities.newBlob(bytes).getDataAsString(charset);
  } catch {
    return Utilities.newBlob(bytes).getDataAsString("UTF-8");
  }
}

/** Sends the exact signed bytes. Without following redirects: a moved URL must be fixed in INGEST_URL. */
function postAlert_(url, request) {
  var response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: Utilities.newBlob("").setDataFromString(request.body, "UTF-8").getBytes(),
    headers: { "X-Al-Corte-Timestamp": request.timestamp, "X-Al-Corte-Signature": request.signature },
    muteHttpExceptions: true,
    followRedirects: false,
  });
  return { status: response.getResponseCode(), body: response.getContentText() };
}
