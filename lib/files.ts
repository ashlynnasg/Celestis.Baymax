import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

export type PickedFile = { name: string; text: string; size: number | null };

const MAX_BYTES = 2_000_000;

/** Opens the platform file picker and returns text content, bounded for the demonstration importer. */
export async function pickTextFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["text/csv", "text/plain", "application/json", "text/comma-separated-values"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const size = asset.size ?? null;
  if (size !== null && size > MAX_BYTES) {
    throw new Error(
      `"${asset.name}" is ${(size / 1_000_000).toFixed(1)} MB. The demonstration importer accepts files up to 2 MB.`,
    );
  }
  let text = "";
  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);
    text = await response.text();
  } else {
    text = new File(asset.uri).textSync();
  }
  if (text.length > MAX_BYTES) {
    throw new Error("The selected file is larger than the 2 MB demonstration limit after decoding.");
  }
  return { name: asset.name, text, size };
}

/** Writes a text artefact and offers it to the user, falling back to clipboard sharing. */
export async function shareTextFile(filename: string, content: string, mimeType = "text/csv"): Promise<string> {
  if (Platform.OS === "web") {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return `Downloaded ${filename}`;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
    return `Shared ${filename}`;
  }
  await Clipboard.setStringAsync(content);
  return `Sharing is unavailable, so ${filename} content was copied to the clipboard.`;
}

export async function copyToClipboard(content: string): Promise<void> {
  await Clipboard.setStringAsync(content);
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Minimal base64 decoder so binary backups work on Hermes without `atob`. */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const length = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(length);
  let byteIndex = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const a = BASE64_ALPHABET.indexOf(clean[index]);
    const b = BASE64_ALPHABET.indexOf(clean[index + 1]);
    const c = clean[index + 2] ? BASE64_ALPHABET.indexOf(clean[index + 2]) : -1;
    const d = clean[index + 3] ? BASE64_ALPHABET.indexOf(clean[index + 3]) : -1;
    if (byteIndex < length) bytes[byteIndex++] = (a << 2) | (b >> 4);
    if (c >= 0 && byteIndex < length) bytes[byteIndex++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0 && byteIndex < length) bytes[byteIndex++] = ((c & 3) << 6) | d;
  }
  return bytes;
}

/** Writes a binary artefact (for example a SQLite backup) and offers it to the user. */
export async function shareBinaryFile(filename: string, base64: string, mimeType: string): Promise<string> {
  const bytes = base64ToBytes(base64);
  if (Platform.OS === "web") {
    const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return `Downloaded ${filename}`;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
    return `Shared ${filename}`;
  }
  return `Saved ${filename} to the app cache folder.`;
}
