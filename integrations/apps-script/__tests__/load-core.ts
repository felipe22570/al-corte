import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

export type MessageHeader = { name: string; value: string };
export type CaptureMessage = { id: string; headers: MessageHeader[]; plain: string | null; html: string | null };
export type CaptureState = Record<string, { s: "processed" | "rejected" | "discarded"; t: number }>;
export type Evaluation = { action: "send"; phrase: string } | { action: "reject" | "discard"; reason: string };
export type CaptureRequest = { body: string; timestamp: string; signature: string };
export type CaptureResponse = { status: number; body: string };
export type CaptureSummary = Record<string, number>;

export type CaptureCore = {
  SENDER: string;
  DOMAIN: string;
  SEARCH_QUERY: string;
  RETENTION_SECONDS: number;
  MAX_BODY_BYTES: number;
  MAX_PHRASE_CHARS: number;
  isGoogleDkimPass(headers: MessageHeader[]): boolean;
  senderAddress(from: string): string;
  htmlToText(html: string): string;
  extractPhrase(text: string): string | null;
  hasCreditCardMarker(phrase: string): boolean;
  partCharset(headers: MessageHeader[]): string;
  utf8Length(text: string): number;
  bytesToHex(bytes: number[]): string;
  buildBody(messageId: string, phrase: string): string;
  evaluateMessage(message: CaptureMessage): Evaluation;
  classifyResponse(status: number, body: string): { outcome: "processed" | "rejected" | "retry"; result?: string; blocking?: boolean };
  parseState(json: string | null): CaptureState;
  pruneState(state: CaptureState, nowSeconds: number): CaptureState;
  processMessages(ids: string[], state: CaptureState, deps: {
    nowSeconds: () => number;
    load: (id: string) => CaptureMessage;
    sign: (text: string) => number[];
    send: (request: CaptureRequest) => CaptureResponse;
  }): { state: CaptureState; summary: CaptureSummary };
  describeSummary(summary: CaptureSummary): string;
};

/**
 * Runs `src/core.js` the way Apps Script does: a plain script in a fresh global scope, with no Google APIs and no
 * module system. Objects it returns belong to another realm; the tests copy them with JSON before comparing.
 */
export function loadCore(): CaptureCore {
  const source = readFileSync(new URL("../src/core.js", import.meta.url), "utf8");
  const context = createContext({});
  runInContext(source, context, { filename: "core.js" });
  return (context as { AlCorteCapture: CaptureCore }).AlCorteCapture;
}
